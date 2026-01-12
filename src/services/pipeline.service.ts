import axios from 'axios';
import { logger } from '../utils/logger';
import { articleService } from './article.service';
import { NewArticle } from '../db/schema';
import { Article, FetchNewsResponse, SummarizeResponse } from '../types';
import { config } from '../config';

class PipelineService {
  private readonly fetchNewsUrl = `http://localhost:${config.server.port}/api/test/fetch-news`;
  private readonly summarizeUrl = `http://localhost:${config.server.port}/api/test/summarize`;

  /**
   * Fetch news articles from the news API
   */
  private async fetchNews(): Promise<Article[]> {
    try {
      logger.info('📡 Fetching news articles...');
      const response = await axios.post<FetchNewsResponse>(this.fetchNewsUrl);

      if (!response.data.success) {
        throw new Error('Failed to fetch news');
      }

      logger.info(`✅ Fetched ${response.data.count} articles`);
      
      // Transform NewsArticle to Article format
      return response.data.articles.map(article => ({
        id: article.id,
        title: article.title,
        url: article.url,
        description: article.description,
        content: article.content,
        publishedAt: new Date(article.publishedAt),
        imageUrl: article.imageUrl,
        sourceName: article.sourceName,
        sourceUrl: article.sourceUrl,
      }));
    } catch (error: any) {
      logger.error(`❌ News fetch failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Summarize article content
   */
  private async summarizeContent(text: string, language: string = 'english'): Promise<string> {
    try {
      const response = await axios.post<SummarizeResponse>(this.summarizeUrl, {
        text,
        language,
      });

      if (!response.data.success) {
        throw new Error('Failed to summarize');
      }

      return response.data.summary;
    } catch (error: any) {
      logger.error(`❌ Summarization failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Main pipeline: fetch → summarize → save
   */
  async executePipeline(): Promise<{ processed: number; saved: number; errors: number }> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      logger.info('🚀 Starting news pipeline...');

      // Step 1: Fetch articles
      const fetchedArticles = await this.fetchNews();
      processed = fetchedArticles.length;

      // Step 2: Prepare articles for database
      const articlesToSave: NewArticle[] = [];

      for (const article of fetchedArticles) {
        try {
          // Use description if available, otherwise summarize content
          let summary = article.description || '';

          if (!summary && article.content && article.content !== 'ONLY AVAILABLE IN PAID PLANS') {
            logger.info(`📝 Summarizing: ${article.title}`);
            summary = await this.summarizeContent(article.content);
            // Add small delay to avoid rate limiting
            await this.delay(100);
          }

          articlesToSave.push({
            title: article.title,
            content: summary,
            url: article.url,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
            bookmarkCount: 0,
          });
        } catch (error: any) {
          logger.error(`❌ Error processing article: ${error.message}`);
          errors++;
        }
      }

      // Step 3: Save to database
      const result = await articleService.saveArticles(articlesToSave);
      const duration = Date.now() - startTime;

      logger.info(`✅ Pipeline completed in ${duration}ms`);
      logger.info(`📊 Summary: ${result.saved} saved, ${result.skipped} skipped, ${errors} errors`);

      return {
        processed,
        saved: result.saved,
        errors,
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
