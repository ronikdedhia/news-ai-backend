import { db } from '../db/client';
import { articles, NewArticle } from '../db/schema';
import { eq, desc, sql, and, or, like, ne } from 'drizzle-orm';
import { logger } from '../utils/logger';

class ArticleService {
  /**
   * Save articles to database, skipping duplicates
   * Returns saved articles directly to avoid additional database reads
   */
  async saveArticles(newArticles: NewArticle[]): Promise<{
    saved: number;
    skipped: number;
    savedArticles: Array<{ id: string; title: string; content: string | null; hashtags: string | null; url: string; imageUrl: string | null }>;
  }> {
    let saved = 0;
    let skipped = 0;
    const savedArticles: Array<{ id: string; title: string; content: string | null; hashtags: string | null; url: string; imageUrl: string | null }> = [];

    for (const article of newArticles) {
      try {
        // Validate article data before insert
        if (!article.title || !article.url) {
          logger.error(`❌ Invalid article data: missing title or url`);
          continue;
        }

        // Skip articles with minimal content (likely paywalled)
        if (article.content && article.content.length < 10) {
          logger.debug(`⏭️  Article skipped (minimal content): ${article.title}`);
          skipped++;
          continue;
        }

        // Skip articles with "ONLY AVAILABLE IN PAID PLANS" or similar paywalled messages
        if (article.content && (article.content.includes('ONLY AVAILABLE') || article.content.includes('paid') || article.content.length < 20)) {
          logger.debug(`⏭️  Article skipped (paywalled): ${article.title}`);
          skipped++;
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

        // Ensure publishedAt is a string in ISO format
        const publishedAtStr = String(article.publishedAt);

        // Sanitize text fields - remove problematic Unicode characters
        const sanitizeText = (text: string | null | undefined): string | null => {
          if (!text) return null;
          return text
            .replace(/[\u2010-\u2015]/g, '-') // Replace various dashes with regular hyphen
            .replace(/[\u201C\u201D]/g, '"') // Replace smart quotes with regular quotes
            .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
            .replace(/[\u00A0]/g, ' '); // Replace non-breaking space with regular space
        };

        // Insert with explicit column mapping; onConflictDoNothing handles duplicate URLs
        const result = await db.insert(articles).values({
          id: article.id,
          title: sanitizeText(article.title) || article.title,
          content: sanitizeText(article.content),
          hashtags: article.hashtags || null,
          url: article.url,
          imageUrl: article.imageUrl || null,
          publishedAt: publishedAtStr,
          bookmarkCount: article.bookmarkCount || 0,
          category: article.category || null,
        }).onConflictDoNothing();
        
        saved++;
        logger.info(`✅ Article saved: ${article.title}`);
        
        // Add to savedArticles array to avoid additional read
        savedArticles.push({
          id: article.id,
          title: article.title,
          content: sanitizeText(article.content),
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
        
        // Check cause for Turso/libSQL which wraps the real SQLite error code in error.cause
        const causeCode = error.cause?.code ?? ''
        if (error.message?.includes('UNIQUE constraint') || error.message?.includes('unique') || causeCode.includes('CONSTRAINT')) {
          logger.warn(`   Duplicate URL — skipping`)
          skipped++
          continue
        }
        logger.error(`   SQLite cause code: ${causeCode}`)
        
        logger.error(`   Full error: ${JSON.stringify(error)}`);
      }
    }

    return { saved, skipped, savedArticles };
  }

  /**
   * Get all articles with pagination - returns title, content, url, imageUrl, hashtags, category
   * Sorted by latest publishedAt first
   */
  async updateArticleAnalysis(
    articleId: string,
    sentiment: string,
    entities: Array<{ name: string; type: string }>
  ) {
    await db.update(articles)
      .set({ sentiment, entities: JSON.stringify(entities) })
      .where(eq(articles.id, articleId));
  }

  async updateWhyItMatters(articleId: string, whyItMatters: string) {
    await db.update(articles)
      .set({ whyItMatters })
      .where(eq(articles.id, articleId));
  }

  async updateArticleQuestions(articleId: string, questions: Array<{ q: string; a: string }>) {
    await db.update(articles)
      .set({ questions: JSON.stringify(questions) })
      .where(eq(articles.id, articleId));
  }

  async updateArticleBias(articleId: string, biasLabel: string, biasScore: number) {
    await db.update(articles)
      .set({ biasLabel, biasScore })
      .where(eq(articles.id, articleId));
  }

  async getArticles(limit: number = 10, offset: number = 0) {
    return db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        hashtags: articles.hashtags,
        url: articles.url,
        imageUrl: articles.imageUrl,
        publishedAt: articles.publishedAt,
        category: articles.category,
        upvoteCount: articles.upvoteCount,
        downvoteCount: articles.downvoteCount,
        sentiment: articles.sentiment,
        entities: articles.entities,
        whyItMatters: articles.whyItMatters,
        questions: articles.questions,
        biasLabel: articles.biasLabel,
        biasScore: articles.biasScore,
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
        publishedAt: articles.publishedAt,
        bookmarkCount: articles.bookmarkCount,
        upvoteCount: articles.upvoteCount,
        downvoteCount: articles.downvoteCount,
        sentiment: articles.sentiment,
        entities: articles.entities,
        category: articles.category,
        whyItMatters: articles.whyItMatters,
        questions: articles.questions,
        biasLabel: articles.biasLabel,
        biasScore: articles.biasScore,
      })
      .from(articles)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(articles.bookmarkCount));
  }

  /**
   * Search articles by title or hashtags
   */
  async searchArticles(query: string, limit: number = 20, offset: number = 0) {
    const searchTerm = `%${query}%`;

    return db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        hashtags: articles.hashtags,
        url: articles.url,
        imageUrl: articles.imageUrl,
        publishedAt: articles.publishedAt,
        bookmarkCount: articles.bookmarkCount,
        upvoteCount: articles.upvoteCount,
        downvoteCount: articles.downvoteCount,
        sentiment: articles.sentiment,
        entities: articles.entities,
        category: articles.category,
        whyItMatters: articles.whyItMatters,
        questions: articles.questions,
        biasLabel: articles.biasLabel,
        biasScore: articles.biasScore,
      })
      .from(articles)
      .where(
        sql`${articles.title} LIKE ${searchTerm} OR ${articles.hashtags} LIKE ${searchTerm}`
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(articles.publishedAt));
  }

  async getSimilarArticles(articleId: string, limit: number = 3) {
    const source = await db
      .select({ hashtags: articles.hashtags })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!source.length || !source[0].hashtags) return [];

    const tags = source[0].hashtags
      .split(/\s+/)
      .filter(t => t.startsWith('#'))
      .slice(0, 4);

    if (tags.length === 0) return [];

    const tagConditions = tags.map(tag => like(articles.hashtags, `%${tag}%`));

    return db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        imageUrl: articles.imageUrl,
        category: articles.category,
      })
      .from(articles)
      .where(and(ne(articles.id, articleId), or(...tagConditions)))
      .limit(limit)
      .orderBy(desc(articles.publishedAt));
  }

  async getRecentArticles(limit: number = 60) {
    return db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        hashtags: articles.hashtags,
        url: articles.url,
        imageUrl: articles.imageUrl,
        publishedAt: articles.publishedAt,
        bookmarkCount: articles.bookmarkCount,
        upvoteCount: articles.upvoteCount,
        downvoteCount: articles.downvoteCount,
        sentiment: articles.sentiment,
        entities: articles.entities,
        category: articles.category,
        whyItMatters: articles.whyItMatters,
        questions: articles.questions,
        biasLabel: articles.biasLabel,
        biasScore: articles.biasScore,
      })
      .from(articles)
      .where(sql`datetime(${articles.publishedAt}) > datetime('now', '-7 days')`)
      .limit(limit)
      .orderBy(desc(articles.publishedAt));
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(category: string, limit: number = 20, offset: number = 0) {
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
      .where(eq(articles.category, category))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(articles.publishedAt));
  }
}

export const articleService = new ArticleService();
