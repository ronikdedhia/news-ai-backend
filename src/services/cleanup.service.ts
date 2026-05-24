import { db } from '../db/client';
import { articles } from '../db/schema';
import { lt } from 'drizzle-orm';
import { logger } from '../utils/logger';

class CleanupService {
  /**
   * Delete articles older than specified days
   */
  async deleteOldArticles(daysOld: number = 30): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      logger.info(`🗑️ Deleting articles older than ${daysOld} days (before ${cutoffDate.toISOString()})`);

      const result = await db
        .delete(articles)
        .where(lt(articles.publishedAt, cutoffDate.toISOString()))
        .returning({ id: articles.id });

      logger.info(`✅ Deleted ${result.length} articles`);
      return { deleted: result.length };
    } catch (error: any) {
      logger.error(`❌ Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of articles that would be deleted
   */
  async getOldArticlesCount(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await db
        .select({ count: articles.id })
        .from(articles)
        .where(lt(articles.publishedAt, cutoffDate.toISOString()));

      return result.length;
    } catch (error: any) {
      logger.error(`❌ Failed to count old articles: ${error.message}`);
      return 0;
    }
  }
}

export const cleanupService = new CleanupService();
