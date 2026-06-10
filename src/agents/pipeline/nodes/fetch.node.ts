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

    logger.info(`📡 [fetch] ${rawArticles.length} articles from ${state.source}`);
    return { rawArticles };
  } catch (error: any) {
    const err: PipelineError = { articleUrl: '', stage: 'fetch', message: error.message };
    logger.error(`❌ [fetch] failed: ${error.message}`);
    return { rawArticles: [], errors: [err] };
  }
}
