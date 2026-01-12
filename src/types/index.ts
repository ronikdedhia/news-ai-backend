import { z } from 'zod';

// NewsData.io API Response Schema
export const NewsDataArticleSchema = z.object({
  article_id: z.string(),
  title: z.string(),
  link: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  pubDate: z.string(),
  image_url: z.string().nullable(),
  source_name: z.string(),
  source_url: z.string(),
});

export const NewsDataResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number(),
  results: z.array(NewsDataArticleSchema),
});

export type NewsDataArticle = z.infer<typeof NewsDataArticleSchema>;
export type NewsDataResponse = z.infer<typeof NewsDataResponseSchema>;

// Internal Article Format
export interface Article {
  id: string;
  title: string;
  url: string;
  description: string | null;
  content: string | null;
  publishedAt: Date;
  imageUrl: string | null;
  sourceName: string;
  sourceUrl: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  content: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
}

export interface FetchNewsResponse {
  success: boolean;
  count: number;
  articles: NewsArticle[];
}

export interface FetchNewsResult {
  success: boolean;
  articles: Article[];
  count: number;
  error?: string;
}

export interface SummarizeResponse {
  success: boolean;
  summary: string;
}

export interface CronJobResult {
  timestamp: string;
  articlesProcessed: number;
  articlesSaved: number;
  errors: string[];
}
