import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { normalizeCategory } from '../constants/categories';
import { articleService } from './article.service';
import { newsDataService } from './newsdata.service';
import { alphaVantageService } from './alpha-vantage.service';
import { groqService } from './groq.service';
import { hashtagService } from './hashtag.service';
import { telegramService } from './telegram.service';
import { NewArticle } from '../db/schema';
import { Article } from '../types';

async function analyzeAndAttach(articleId: string, title: string, content: string) {
  try {
    const analysis = await groqService.analyzeArticle(title, content);
    await articleService.updateArticleAnalysis(articleId, analysis.sentiment, analysis.entities);

    const why = await groqService.generateWhyItMatters(title, content);
    if (why) await articleService.updateWhyItMatters(articleId, why);

    const questions = await groqService.generateQuestions(title, content);
    if (questions.length) await articleService.updateArticleQuestions(articleId, questions);

    const bias = await groqService.detectBias(title, content);
    if (bias.label) await articleService.updateArticleBias(articleId, bias.label, bias.score);
  } catch (e: any) {
    logger.warn(`analyzeAndAttach skipped for ${articleId}: ${e.message}`);
  }
}

class PipelineService {
  /**
   * Fetch news articles from NewsData only
   */
  private async fetchNewsDataArticles(): Promise<Article[]> {
    try {
      logger.info('📡 Fetching news articles from NewsData...');
      const articles = await newsDataService.fetchLatestNews(10);
      logger.info(`✅ Fetched ${articles.length} articles from NewsData`);
      return articles;
    } catch (error: any) {
      logger.error(`❌ NewsData fetch failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch news articles from Alpha Vantage only
   */
  private async fetchAlphaVantageArticles(): Promise<Article[]> {
    try {
      logger.info('📡 Fetching stock news from Alpha Vantage...');
      const stockNews = await alphaVantageService.fetchStockNews(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'], 10);
      const articles: Article[] = stockNews.map(news => ({
        id: news.id,
        title: news.title,
        content: news.description,
        url: news.url,
        imageUrl: news.image_path,
        source: news.source,
        publishedAt: new Date(news.published_at),
        category: 'business',
        language: 'English',
        country: 'USA',
      }));
      logger.info(`✅ Fetched ${articles.length} articles from Alpha Vantage`);
      return articles;
    } catch (error: any) {
      logger.error(`❌ Alpha Vantage fetch failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch news articles from both sources (for backward compatibility)
   */
  private async fetchNews(): Promise<Article[]> {
    try {
      logger.info('📡 Fetching news articles from multiple sources...');
      const newsDataArticles = await this.fetchNewsDataArticles();
      const alphaVantageArticles = await this.fetchAlphaVantageArticles();
      const allArticles = [...newsDataArticles, ...alphaVantageArticles];
      logger.info(`✅ Total fetched: ${allArticles.length} articles`);
      return allArticles;
    } catch (error: any) {
      logger.error(`❌ News fetch failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main pipeline: fetch → summarize → save → send to Telegram
   */
  async executePipeline(): Promise<{ processed: number; saved: number; errors: number; telegramSent: number }> {
    const startTime = Date.now();
    let processed = 0;
    let saved = 0;
    let errors = 0;
    let telegramSent = 0;

    try {
      logger.info('🚀 Starting news pipeline...');

      // Step 1: Fetch articles
      const fetchedArticles = await this.fetchNews();
      processed = fetchedArticles.length;

      // Step 2: Process each article
      for (const article of fetchedArticles) {
        try {
          // Check if article already exists
          const existingArticle = await articleService.getArticleByUrl(article.url);
          if (existingArticle && existingArticle.length > 0) {
            logger.debug(`⏭️  Article already exists: ${article.title}`);
            continue;
          }

          // Generate title summary
          const titleSummary = await groqService.summarizeTitle(article.title);

          // Summarize article content/description
          const contentSummary = await groqService.summarizeText(article.content || article.title);

          // Generate hashtags
          const hashtags = await hashtagService.generateHashtags(article.title);

          // Save article with summaries and hashtags
          const result = await articleService.saveArticles([{
            id: randomUUID(),
            title: titleSummary,
            url: article.url,
            content: contentSummary,
            publishedAt: article.publishedAt instanceof Date ? article.publishedAt.toISOString() : String(article.publishedAt),
            imageUrl: article.imageUrl,
            category: normalizeCategory(article.category),
            hashtags: hashtags.join(' '),
            bookmarkCount: 0,
          }]);

          saved += result.saved;
          logger.info(`✅ Saved article: ${titleSummary}`);

          // Send to Telegram + run analysis if article was saved
          if (result.savedArticles.length > 0) {
            const savedId = result.savedArticles[0].id;
            analyzeAndAttach(savedId, titleSummary, contentSummary).catch(() => {});

            try {
              const savedArticle = result.savedArticles[0];
              const hashtagsArray = savedArticle.hashtags ? savedArticle.hashtags.split(/\s+/) : [];

              const tgSent = await telegramService.sendMessage({
                title: savedArticle.title,
                content: savedArticle.content || 'No content available',
                hashtags: hashtagsArray,
                url: article.url,
                imageUrl: savedArticle.imageUrl,
              });
              if (tgSent) telegramSent++;
            } catch (telegramError: any) {
              logger.warn(`⚠️  Failed to send to Telegram: ${telegramError.message}`);
            }
          }

          // Rate limiting - wait between articles
          await this.delay(2000);
        } catch (articleError: any) {
          errors++;
          logger.error(`❌ Failed to process article: ${articleError.message}`);
        }
      }

      const duration = Date.now() - startTime;

      logger.info(`✅ Pipeline completed in ${duration}ms`);
      logger.info(`📊 Summary: ${saved} saved, ${processed - saved} skipped, ${errors} errors, ${telegramSent} Telegram messages sent`);

      return {
        processed,
        saved,
        errors,
        telegramSent,
      };
    } catch (error: any) {
      logger.error(`❌ Pipeline failed: ${error.message}`);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute NewsData pipeline only
   */
  async executeNewsDataPipeline(): Promise<{ processed: number; saved: number; errors: number; telegramSent: number }> {
    const startTime = Date.now();
    let processed = 0;
    let saved = 0;
    let errors = 0;
    let telegramSent = 0;

    try {
      logger.info('🚀 Starting NewsData pipeline...');

      const fetchedArticles = await this.fetchNewsDataArticles();
      processed = fetchedArticles.length;

      for (const article of fetchedArticles) {
        try {
          const existingArticle = await articleService.getArticleByUrl(article.url);
          if (existingArticle && existingArticle.length > 0) {
            logger.debug(`⏭️  Article already exists: ${article.title}`);
            continue;
          }

          const titleSummary = await groqService.summarizeTitle(article.title);
          const contentSummary = await groqService.summarizeText(article.content || article.title);
          const hashtags = await hashtagService.generateHashtags(article.title);

          const result = await articleService.saveArticles([{
            id: randomUUID(),
            title: titleSummary,
            url: article.url,
            content: contentSummary,
            publishedAt: article.publishedAt instanceof Date ? article.publishedAt.toISOString() : String(article.publishedAt),
            imageUrl: article.imageUrl,
            category: normalizeCategory(article.category),
            hashtags: hashtags.join(' '),
            bookmarkCount: 0,
          }]);

          saved += result.saved;
          logger.info(`✅ Saved article: ${titleSummary}`);

          if (result.savedArticles.length > 0) {
            const savedId = result.savedArticles[0].id;
            analyzeAndAttach(savedId, titleSummary, contentSummary).catch(() => {});

            try {
              const savedArticle = result.savedArticles[0];
              const hashtagsArray = savedArticle.hashtags ? savedArticle.hashtags.split(/\s+/) : [];

              const tgSent = await telegramService.sendMessage({
                title: savedArticle.title,
                content: savedArticle.content || 'No content available',
                hashtags: hashtagsArray,
                url: article.url,
                imageUrl: savedArticle.imageUrl,
              });
              if (tgSent) telegramSent++;
            } catch (telegramError: any) {
              logger.warn(`⚠️  Failed to send to Telegram: ${telegramError.message}`);
            }
          }

          await this.delay(2000);
        } catch (articleError: any) {
          errors++;
          logger.error(`❌ Failed to process article: ${articleError.message}`);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ NewsData pipeline completed in ${duration}ms`);
      logger.info(`📊 Summary: ${saved} saved, ${processed - saved} skipped, ${errors} errors, ${telegramSent} Telegram messages sent`);

      return { processed, saved, errors, telegramSent };
    } catch (error: any) {
      logger.error(`❌ NewsData pipeline failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute Alpha Vantage pipeline only
   */
  async executeAlphaVantagePipeline(): Promise<{ processed: number; saved: number; errors: number; telegramSent: number }> {
    const startTime = Date.now();
    let processed = 0;
    let saved = 0;
    let errors = 0;
    let telegramSent = 0;

    try {
      logger.info('🚀 Starting Alpha Vantage pipeline...');

      const fetchedArticles = await this.fetchAlphaVantageArticles();
      processed = fetchedArticles.length;

      for (const article of fetchedArticles) {
        try {
          const existingArticle = await articleService.getArticleByUrl(article.url);
          if (existingArticle && existingArticle.length > 0) {
            logger.debug(`⏭️  Article already exists: ${article.title}`);
            continue;
          }

          const titleSummary = await groqService.summarizeTitle(article.title);
          const contentSummary = await groqService.summarizeText(article.content || article.title);
          const hashtags = await hashtagService.generateHashtags(article.title);

          const result = await articleService.saveArticles([{
            id: randomUUID(),
            title: titleSummary,
            url: article.url,
            content: contentSummary,
            publishedAt: article.publishedAt instanceof Date ? article.publishedAt.toISOString() : String(article.publishedAt),
            imageUrl: article.imageUrl,
            category: normalizeCategory(article.category),
            hashtags: hashtags.join(' '),
            bookmarkCount: 0,
          }]);

          saved += result.saved;
          logger.info(`✅ Saved article: ${titleSummary}`);

          if (result.savedArticles.length > 0) {
            const savedId = result.savedArticles[0].id;
            analyzeAndAttach(savedId, titleSummary, contentSummary).catch(() => {});

            try {
              const savedArticle = result.savedArticles[0];
              const hashtagsArray = savedArticle.hashtags ? savedArticle.hashtags.split(/\s+/) : [];

              const tgSent = await telegramService.sendMessage({
                title: savedArticle.title,
                content: savedArticle.content || 'No content available',
                hashtags: hashtagsArray,
                url: article.url,
                imageUrl: savedArticle.imageUrl,
              });
              if (tgSent) telegramSent++;
            } catch (telegramError: any) {
              logger.warn(`⚠️  Failed to send to Telegram: ${telegramError.message}`);
            }
          }

          await this.delay(2000);
        } catch (articleError: any) {
          errors++;
          logger.error(`❌ Failed to process article: ${articleError.message}`);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ Alpha Vantage pipeline completed in ${duration}ms`);
      logger.info(`📊 Summary: ${saved} saved, ${processed - saved} skipped, ${errors} errors, ${telegramSent} Telegram messages sent`);

      return { processed, saved, errors, telegramSent };
    } catch (error: any) {
      logger.error(`❌ Alpha Vantage pipeline failed: ${error.message}`);
      throw error;
    }
  }
}

export const pipelineService = new PipelineService();
