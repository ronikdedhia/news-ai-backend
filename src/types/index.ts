import { z } from 'zod';

export const NewsDataResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number(),
  results: z.array(z.object({
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
  })),
});

export type NewsDataResponse = z.infer<typeof NewsDataResponseSchema>;

export interface Article {
  id: string;
  title: string;
  url: string;
  content: string | null;
  publishedAt: Date;
  imageUrl: string | null;
  category: string | null;
}
