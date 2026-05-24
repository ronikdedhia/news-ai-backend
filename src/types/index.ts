import { z } from 'zod';

// NewsData.io API Response Schema
export const NewsDataArticleSchema = z.object({
  article_id: z.string(),
  title: z.string(),
  link: z.string(),
  description: z.string().nullable(),
  pubDate: z.string(),
  image_url: z.string().nullable(),
  category: z.union([z.string(), z.array(z.string())]).nullable().transform((val) => {
    if (Array.isArray(val)) return val[0] || null;
    return val;
  }),
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
  content: string | null;
  publishedAt: Date;
  imageUrl: string | null;
  category: string | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  category: string | null;
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

// Zod schemas for LLM output validation
export const SummarizedTitleSchema = z.string()
  .min(1, 'Title cannot be empty')
  .max(100, 'Title must be max 100 characters')
  .refine(
    (title) => title.split(/\s+/).length <= 8,
    'Title must contain max 8 words'
  );

export const SummarizedContentSchema = z.string()
  .min(10, 'Summary must be at least 10 characters')
  .max(500, 'Summary must be max 750 characters')
  .refine(
    (content) => content.split(/\s+/).length <= 100,
    'Summary must contain max 100 words'
  );

export type SummarizedTitle = z.infer<typeof SummarizedTitleSchema>;
export type SummarizedContent = z.infer<typeof SummarizedContentSchema>;

export interface CronJobResult {
  timestamp: string;
  articlesProcessed: number;
  articlesSaved: number;
  errors: string[];
}

export interface SummarizeResult {
  success: boolean;
  articlesProcessed: number;
  summaries: Array<{ articleId: string; summary: string }>;
  errors: Array<{ articleId: string; error: string }>;
}
