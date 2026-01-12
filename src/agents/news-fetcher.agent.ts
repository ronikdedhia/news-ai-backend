import { newsDataService } from '../services/newsdata.service';
import { Article, FetchNewsResult } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

class NewsFetcherAgent {
  async execute(): Promise<FetchNewsResult> {
    try {
      logger.info('🤖 News Fetcher Agent: Starting execution...');

      // Fetch articles from NewsData.io
      const articles = await newsDataService.fetchLatestNews(
        config.features.maxArticlesToFetch
      );

      // Deduplicate by URL (in case of duplicates)
      const uniqueArticles = this.deduplicateArticles(articles);

      logger.info(`✅ News Fetcher Agent: Successfully fetched ${uniqueArticles.length} unique articles`);

      return {
        success: true,
        articles: uniqueArticles,
        count: uniqueArticles.length,
      };
    } catch (error: any) {
      logger.error('❌ News Fetcher Agent: Execution failed', {
        error: error.message,
      });

      return {
        success: false,
        articles: [],
        count: 0,
        error: error.message,
      };
    }
  }

  private deduplicateArticles(articles: Article[]): Article[] {
    const seen = new Set<string>();
    const unique: Article[] = [];

    for (const article of articles) {
      if (!seen.has(article.url)) {
        seen.add(article.url);
        unique.push(article);
      }
    }

    logger.debug(`Deduplicated ${articles.length - unique.length} duplicate articles`);

    return unique;
  }
}

export const newsFetcherAgent = new NewsFetcherAgent();