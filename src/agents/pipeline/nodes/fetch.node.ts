import { logger } from '../../../utils/logger';
import { newsDataService } from '../../../services/newsdata.service';
import { alphaVantageService } from '../../../services/alpha-vantage.service';
import { Article } from '../../../types';
import { PipelineState, PipelineError } from '../state';

export async function fetchNode(state: PipelineState): Promise<Partial<PipelineState>> {
  try {
    let rawArticles: Article[] = [];

    if (state.source === 'newsdata') {
      rawArticles = await newsDataService.fetchLatestNews(10);
    } else {
      const stockNews = await alphaVantageService.fetchStockNews(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'], 10);
      rawArticles = stockNews.map(news => ({
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
    }

    if (rawArticles.length === 0) {
      logger.warn(`⚠️ [fetch] 0 articles from ${state.source} — API returned empty`);
    } else {
      logger.info(`📡 [fetch] ${rawArticles.length} articles from ${state.source}`);
      logger.info(`📡 [fetch] sample URLs: ${rawArticles.slice(0, 3).map(a => a.url).join(' | ')}`);
    }
    return { rawArticles };
  } catch (error: any) {
    const err: PipelineError = { articleUrl: '', stage: 'fetch', message: error.message };
    logger.error(`❌ [fetch] failed: ${error.message}`);
    return { rawArticles: [], errors: [err] };
  }
}
