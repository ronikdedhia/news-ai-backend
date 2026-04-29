import { createHash } from 'crypto';
import { logger } from '../utils/logger';

export interface StockNews {
  id: string;
  title: string;
  description: string;
  image_path: string;
  url: string;
  source: string;
  published_at: string;
  ticker: string;
  sentiment: string;
}

class AlphaVantageService {
  private baseUrl = 'https://www.alphavantage.co/query';
  private apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  async fetchStockNews(tickers: string[] = ['AAPL', 'MSFT', 'GOOGL'], limit: number = 10): Promise<StockNews[]> {
    try {
      if (!this.apiKey) {
        throw new Error('ALPHA_VANTAGE_API_KEY not configured');
      }

      logger.info(`📈 Fetching stock news for ${tickers.join(', ')} from Alpha Vantage...`);

      const allNews: StockNews[] = [];

      for (const ticker of tickers) {
        if (allNews.length >= limit) break;

        try {
          const response = await fetch(
            `${this.baseUrl}?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${this.apiKey}`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'NewsAI/1.0',
              },
            }
          );

          if (!response.ok) {
            logger.warn(`Alpha Vantage API returned ${response.status} for ${ticker}`);
            continue;
          }

          const data = await response.json() as any;

          // Check for API errors
          if (data.Note || data.Error) {
            logger.warn(`Alpha Vantage API error for ${ticker}:`, data.Note || data.Error);
            continue;
          }

          if (!data.feed || !Array.isArray(data.feed)) {
            logger.warn(`No news feed for ${ticker}`);
            continue;
          }

          const tickerNews = data.feed.slice(0, limit - allNews.length).map((item: any) => ({
            id: createHash('md5').update(item.url || '').digest('hex'),
            title: item.title || 'Untitled',
            description: item.summary || '',
            image_path: item.banner_image || '',
            url: item.url || '',
            source: item.source || 'Alpha Vantage',
            published_at: new Date().toISOString(),
            ticker: ticker,
            sentiment: item.overall_sentiment_label || 'NEUTRAL',
          }));

          allNews.push(...tickerNews);
        } catch (error: any) {
          logger.warn(`Error fetching news for ${ticker}:`, error.message);
          continue;
        }
      }

      logger.info(`✅ Fetched ${allNews.length} stock news articles`);
      return allNews.slice(0, limit);
    } catch (error: any) {
      logger.error('Alpha Vantage Service Error:', error.message);
      throw error;
    }
  }
}

export const alphaVantageService = new AlphaVantageService();
