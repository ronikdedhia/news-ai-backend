import { db } from '../db/client';
import { articles, NewArticle } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';

class ArticleService {
  /**
   * Save articles to database, skipping duplicates
   * Returns saved articles directly to avoid additional database reads
   */
  async saveArticles(newArticles: NewArticle[]): Promise<{ 
    saved: number; 
    skipped: number;
    savedArticles: Array<{ title: string; content: string | null; hashtags: string | null; url: string; imageUrl: string | null }>;
  }> {
    let saved = 0;
    let skipped = 0;
    const savedArticles: Array<{ title: string; content: string | null; hashtags: string | null; url: string; imageUrl: string | null }> = [];

    for (const article of newArticles) {
      try {
        // Validate article data before insert
        if (!article.title || !article.url) {
          logger.error(`❌ Invalid article data: missing title or url`);
          continue;
        }

        // Check if article already exists by URL
        const existing = await db
          .select()
          .from(articles)
          .where(eq(articles.url, article.url))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          logger.debug(`⏭️  Article skipped (duplicate): ${article.title}`);
          continue;
        }

        // Log the data being inserted for debugging
        logger.debug(`Inserting article: title=${article.title}, url=${article.url}, publishedAt=${article.publishedAt}`);

        // Insert with explicit column mapping
        const result = await db.insert(articles).values({
          id: article.id,
          title: article.title,
          content: article.content || null,
          url: article.url,
          imageUrl: article.imageUrl || null,
          publishedAt: article.publishedAt,
          bookmarkCount: article.bookmarkCount || 0,
          category: article.category || null,
        });
        
        saved++;
        logger.info(`✅ Article saved: ${article.title}`);
        
        // Add to savedArticles array to avoid additional read
        savedArticles.push({
          title: article.title,
          content: article.content || null,
          hashtags: article.hashtags || null,
          url: article.url,
          imageUrl: article.imageUrl || null,
        });
      } catch (error: any) {
        logger.error(`❌ Failed to save article "${article.title}"`);
        logger.error(`   Error: ${error.message}`);
        logger.error(`   Code: ${error.code}`);
        if (error.detail) logger.error(`   Detail: ${error.detail}`);
        if (error.constraint) logger.error(`   Constraint: ${error.constraint}`);
        logger.error(`   Full error: ${JSON.stringify(error)}`);
      }
    }

    return { saved, skipped, savedArticles };
  }

  /**
   * Get all articles with pagination - returns title, content, url, imageUrl, hashtags, category
   * Sorted by latest publishedAt first
   */
  async getArticles(limit: number = 10, offset: number = 0) {
    return db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        hashtags: articles.hashtags,
        url: articles.url,
        imageUrl: articles.imageUrl,
        category: articles.category,
      })
      .from(articles)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(articles.publishedAt));
  }

  /**
   * Get article by URL
   */
  async getArticleByUrl(url: string) {
    return db
      .select()
      .from(articles)
      .where(eq(articles.url, url))
      .limit(1);
  }

  /**
   * Update bookmark count - increment or decrement
   * action: 'increment' or 'decrement'
   */
  async updateBookmarkCount(articleId: string, action: 'increment' | 'decrement'): Promise<{ success: boolean; bookmarkCount: number }> {
    try {
      // Get current bookmark count
      const article = await db
        .select({ bookmarkCount: articles.bookmarkCount })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);

      if (!article || article.length === 0) {
        throw new Error('Article not found');
      }

      const currentCount = article[0].bookmarkCount as number;
      const newCount = action === 'increment' ? currentCount + 1 : Math.max(0, currentCount - 1);

      // Update bookmark count
      await db
        .update(articles)
        .set({ bookmarkCount: newCount })
        .where(eq(articles.id, articleId));

      logger.info(`✅ Bookmark ${action}ed for article ${articleId}: ${currentCount} → ${newCount}`);

      return { success: true, bookmarkCount: newCount };
    } catch (error: any) {
      logger.error(`❌ Failed to update bookmark: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get trending articles sorted by bookmark count (highest first)
   */
  async getTrendingArticles(limit: number = 10, offset: number = 0) {
    return db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        hashtags: articles.hashtags,
        url: articles.url,
        imageUrl: articles.imageUrl,
        bookmarkCount: articles.bookmarkCount,
        category: articles.category,
      })
      .from(articles)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(articles.bookmarkCount));
  }
}

export const articleService = new ArticleService();
