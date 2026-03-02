import axios from 'axios';
import { logger } from '../utils/logger';
import { articleService } from './article.service';
import { newsDataService } from './newsdata.service';
import { groqService } from './groq.service';
import { hashtagService } from './hashtag.service';
import { telegramService } from './telegram.service';
import { NewArticle } from '../db/schema';
import { Article } from '../types';

class PipelineService {
  /**
   * Fetch news articles directly from NewsData service
   */
  private async fetchNews(): Promise<Article[]> {
    try {
      logger.info('📡 Fetching news articles...');
      const articles = await newsDataService.fetchLatestNews(10);
      logger.info(`✅ Fetched ${articles.length} articles`);
      return articles;
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

          // Summarize article
          const summary = await groqService.summarizeText(article.content || '');

          // Generate hashtags
          const hashtags = await hashtagService.generateHashtags(article.title);

          // Save article with summary and hashtags
          const result = await articleService.saveArticles([{
            id: article.id,
            title: article.title,
            url: article.url,
            content: article.content,
            publishedAt: article.publishedAt instanceof Date ? article.publishedAt.toISOString() : String(article.publishedAt),
            imageUrl: article.imageUrl,
            category: article.category,
            hashtags: hashtags.join(','),
            bookmarkCount: 0,
          }]);

          saved += result.saved;
          logger.info(`✅ Saved article: ${article.title}`);

          // Send to Telegram if article was saved
          if (result.savedArticles.length > 0) {
            try {
              const savedArticle = result.savedArticles[0];
              const hashtagsArray = savedArticle.hashtags ? savedArticle.hashtags.split(',') : [];
              
              await telegramService.sendMessage({
                title: article.title,
                content: savedArticle.content || 'No content available',
                hashtags: hashtagsArray,
                url: article.url,
                imageUrl: savedArticle.imageUrl,
              });
              telegramSent++;
            } catch (telegramError: any) {
              logger.warn(`⚠️  Failed to send to Telegram: ${telegramError.message}`);
            }
          }

          // Rate limiting - wait between articles
          await this.delay(1000);
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
}

export const pipelineService = new PipelineService();
