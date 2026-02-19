import { logger } from '../utils/logger';
import { Hashtags, HashtagSchema } from '../types/hashtag';

class HashtagService {
  /**
   * Generate hashtags from text using keyword extraction
   * Input: Article title or summary
   * Output: Array of max 4 hashtags
   */
  async generateHashtags(text: string): Promise<Hashtags> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      logger.debug(`🏷️ Generating hashtags for: "${text.substring(0, 50)}..."`);

      // Extract hashtags using keyword extraction logic
      const hashtags = this.extractHashtags(text);

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
   * Extract hashtags from text using keyword extraction
   * Identifies important words and converts them to hashtags
   */
  private extractHashtags(text: string): string[] {
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'same', 'so', 'than', 'too', 'very',
      'as', 'if', 'just', 'now', 'has', 'his', 'her', 'their', 'its'
    ]);

    // Split text into words and clean them
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Count word frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Sort by frequency and get top words
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([word]) => `#${word}`);

    return topWords.length > 0 ? topWords : ['#news'];
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
        results.push([]);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const hashtagService = new HashtagService();
