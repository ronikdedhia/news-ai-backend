import { db } from '../db/client';
import { articles, NewArticle } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

class ArticleService {
  /**
   * Save articles to database, skipping duplicates
   */
  async saveArticles(newArticles: NewArticle[]): Promise<{ saved: number; skipped: number }> {
    let saved = 0;
    let skipped = 0;

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
          title: article.title,
          content: article.content || null,
          url: article.url,
          imageUrl: article.imageUrl || null,
          publishedAt: article.publishedAt,
          bookmarkCount: article.bookmarkCount || 0,
        });
        
        saved++;
        logger.info(`✅ Article saved: ${article.title}`);
      } catch (error: any) {
        logger.error(`❌ Failed to save article "${article.title}"`);
        logger.error(`   Error: ${error.message}`);
        logger.error(`   Code: ${error.code}`);
        if (error.detail) logger.error(`   Detail: ${error.detail}`);
        if (error.constraint) logger.error(`   Constraint: ${error.constraint}`);
        logger.error(`   Full error: ${JSON.stringify(error)}`);
      }
    }

    return { saved, skipped };
  }

  /**
   * Get all articles with optional pagination
   */
  async getArticles(limit: number = 10, offset: number = 0) {
    return db
      .select()
      .from(articles)
      .limit(limit)
      .offset(offset)
      .orderBy(articles.publishedAt);
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
}

export const articleService = new ArticleService();
