import { z } from 'zod';

// Hugging Face API Response Schema
export const HashtagResponseSchema = z.object({
  generated_text: z.string(),
});

export type HashtagResponse = z.infer<typeof HashtagResponseSchema>;

// Internal Hashtag Format
export const HashtagSchema = z.array(z.string())
  .min(1, 'At least one hashtag required')
  .max(4, 'Maximum 4 hashtags allowed')
  .refine(
    (tags) => tags.every(tag => tag.startsWith('#') && tag.length > 1),
    'All hashtags must start with # and have content'
  );

export type Hashtags = z.infer<typeof HashtagSchema>;

export interface HashtagGenerationResult {
  success: boolean;
  hashtags: string[];
  error?: string;
}
