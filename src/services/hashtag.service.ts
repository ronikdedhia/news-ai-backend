import { logger } from '../utils/logger';
import { Hashtags, HashtagSchema } from '../types/hashtag';
import Groq from 'groq-sdk';
import { config } from '../config';

class HashtagService {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: config.groq.apiKey,
    });
  }

  /**
   * Generate exactly 4 hashtags using Groq LLM
   */
  async generateHashtags(text: string): Promise<Hashtags> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      logger.debug(`🏷️ Generating hashtags for: "${text.substring(0, 50)}..."`);

      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a hashtag generator. Generate exactly 4 relevant hashtags for the given text. Return ONLY the hashtags separated by spaces, no other text. Format: #tag1 #tag2 #tag3 #tag4',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        model: config.groq.model,
        temperature: 0.3,
        max_tokens: 50,
        top_p: 1,
      });

      const hashtagsText = completion.choices[0]?.message?.content?.trim() || '';
      const hashtags = hashtagsText.split(/\s+/).filter(tag => tag.startsWith('#')).slice(0, 4);

      // Validate with Zod schema
      const validated = HashtagSchema.parse(hashtags);

      logger.debug(`✅ Generated hashtags: ${validated.join(', ')}`);
      return validated;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        logger.error(`❌ Hashtag validation failed: ${error.message}`);
        throw new Error(`Hashtags do not meet constraints: ${error.errors[0]?.message}`);
      }

      logger.error(`❌ Hashtag generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch generate hashtags for multiple texts
   */
  async generateHashtagsBatch(texts: string[]): Promise<Hashtags[]> {
    const results: Hashtags[] = [];

    for (const text of texts) {
      try {
        const hashtags = await this.generateHashtags(text);
        results.push(hashtags);

        // Small delay
        await this.delay(50);
      } catch (error: any) {
        logger.warn(`Failed to generate hashtags for text: ${error.message}`);
        results.push(['#news']);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const hashtagService = new HashtagService();
