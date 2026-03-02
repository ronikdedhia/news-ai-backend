import { db } from '../db/client';
import { userBookmarks, articles } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

class BookmarkService {
  /**
   * Add bookmark for user
   */
  async addBookmark(userId: string, articleId: string): Promise<{ success: boolean; bookmarkId: string }> {
    try {
      // Check if already bookmarked
      const existing = await db
        .select()
        .from(userBookmarks)
        .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.articleId, articleId)))
        .limit(1);

      if (existing.length > 0) {
        return { success: true, bookmarkId: existing[0].id };
      }

      const bookmarkId = uuidv4();
      await db.insert(userBookmarks).values({
        id: bookmarkId,
        userId,
        articleId,
        createdAt: new Date().toISOString(),
      });

      // Increment bookmark count on article
      await db
        .update(articles)
        .set({ bookmarkCount: articles.bookmarkCount + 1 })
        .where(eq(articles.id, articleId));

      logger.info(`✅ Bookmark added: user=${userId}, article=${articleId}`);
      return { success: true, bookmarkId };
    } catch (error: any) {
      logger.error(`❌ Failed to add bookmark: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove bookmark for user
   */
  async removeBookmark(userId: string, articleId: string): Promise<{ success: boolean }> {
    try {
      await db
        .delete(userBookmarks)
        .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.articleId, articleId)));

      // Decrement bookmark count on article
      const article = await db
        .select({ bookmarkCount: articles.bookmarkCount })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);

      if (article.length > 0) {
        const newCount = Math.max(0, (article[0].bookmarkCount as number) - 1);
        await db
          .update(articles)
          .set({ bookmarkCount: newCount })
          .where(eq(articles.id, articleId));
      }

      logger.info(`✅ Bookmark removed: user=${userId}, article=${articleId}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`❌ Failed to remove bookmark: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user has bookmarked an article
   */
  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(userBookmarks)
        .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.articleId, articleId)))
        .limit(1);

      return result.length > 0;
    } catch (error: any) {
      logger.error(`❌ Failed to check bookmark: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all bookmarks for a user
   */
  async getUserBookmarks(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const bookmarks = await db
        .select({
          id: articles.id,
          title: articles.title,
          content: articles.content,
          hashtags: articles.hashtags,
          url: articles.url,
          imageUrl: articles.imageUrl,
          bookmarkCount: articles.bookmarkCount,
          bookmarkedAt: userBookmarks.createdAt,
        })
        .from(userBookmarks)
        .innerJoin(articles, eq(userBookmarks.articleId, articles.id))
        .where(eq(userBookmarks.userId, userId))
        .limit(limit)
        .offset(offset)
        .orderBy(userBookmarks.createdAt);

      return bookmarks;
    } catch (error: any) {
      logger.error(`❌ Failed to get user bookmarks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bookmark count for user
   */
  async getBookmarkCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select()
        .from(userBookmarks)
        .where(eq(userBookmarks.userId, userId));

      return result.length;
    } catch (error: any) {
      logger.error(`❌ Failed to get bookmark count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check multiple articles for bookmarks
   */
  async checkMultipleBookmarks(userId: string, articleIds: string[]): Promise<Record<string, boolean>> {
    try {
      const bookmarks = await db
        .select({ articleId: userBookmarks.articleId })
        .from(userBookmarks)
        .where(and(eq(userBookmarks.userId, userId)));

      const bookmarkedIds = new Set(bookmarks.map(b => b.articleId));
      const result: Record<string, boolean> = {};

      articleIds.forEach(id => {
        result[id] = bookmarkedIds.has(id);
      });

      return result;
    } catch (error: any) {
      logger.error(`❌ Failed to check multiple bookmarks: ${error.message}`);
      return {};
    }
  }
}

export const bookmarkService = new BookmarkService();
