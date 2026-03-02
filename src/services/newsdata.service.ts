import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config';
import { NewsDataResponse, NewsDataResponseSchema, Article } from '../types';
import { logger } from '../utils/logger';

class NewsDataService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.newsdata.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure retry logic
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               error.response?.status === 429;
      },
    });
  }

  async fetchLatestNews(maxArticles: number = 10): Promise<Article[]> {
    try {
      logger.info(`Fetching ${maxArticles} latest news articles from NewsData.io`);

      const response = await this.client.get('/news', {
        params: {
          apikey: config.newsdata.apiKey,
          country: 'in',
          language: 'en',
          category: 'education,entertainment,politics,sports,technology',
          timezone: 'asia/kolkata',
          image: 1,
          removeduplicate: 1,
          size: 10,
        },
      });

      // Validate response with Zod
      const validatedData = NewsDataResponseSchema.parse(response.data);

      logger.info(`Successfully fetched ${validatedData.results.length} articles`);

      // Transform to internal Article format
      const articles: Article[] = validatedData.results.map((item) => ({
        id: item.article_id,
        title: item.title,
        url: item.link,
        content: item.content,
        publishedAt: new Date(item.pubDate),
        imageUrl: item.image_url,
        category: item.category,
      }));

      return articles;
    } catch (error: any) {
      logger.error('Error fetching news from NewsData.io', {
        message: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 401) {
        throw new Error('Invalid NewsData.io API key');
      } else if (error.response?.status === 429) {
        throw new Error('NewsData.io rate limit exceeded');
      } else if (error.response?.status === 422) {
        throw new Error(`Invalid request parameters: ${error.response?.data?.results?.message || 'Unknown error'}`);
      }

      throw new Error(`Failed to fetch news: ${error.message}`);
    }
  }
}

export const newsDataService = new NewsDataService();
