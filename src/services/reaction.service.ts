import { db } from '../db/client';
import { articleReactions, articles } from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

class ReactionService {
  async reactToArticle(userId: string, articleId: string, type: 'upvote' | 'downvote') {
    const existing = await db
      .select()
      .from(articleReactions)
      .where(and(eq(articleReactions.userId, userId), eq(articleReactions.articleId, articleId)))
      .limit(1);

    if (existing.length > 0) {
      const oldType = existing[0].type as 'upvote' | 'downvote';

      if (oldType === type) {
        // Toggle off
        await db.delete(articleReactions).where(eq(articleReactions.id, existing[0].id));
        await this.adjustCount(articleId, type, -1);
        return { reaction: null };
      }

      // Switch reaction
      await db.update(articleReactions).set({ type }).where(eq(articleReactions.id, existing[0].id));
      await this.adjustCount(articleId, oldType, -1);
      await this.adjustCount(articleId, type, 1);
      return { reaction: type };
    }

    await db.insert(articleReactions).values({
      id: crypto.randomUUID(),
      userId,
      articleId,
      type,
      createdAt: new Date().toISOString(),
    });
    await this.adjustCount(articleId, type, 1);
    return { reaction: type };
  }

  private async adjustCount(articleId: string, type: 'upvote' | 'downvote', delta: number) {
    if (type === 'upvote') {
      await db.update(articles)
        .set({ upvoteCount: sql`MAX(0, ${articles.upvoteCount} + ${delta})` })
        .where(eq(articles.id, articleId));
    } else {
      await db.update(articles)
        .set({ downvoteCount: sql`MAX(0, ${articles.downvoteCount} + ${delta})` })
        .where(eq(articles.id, articleId));
    }
  }

  async getUserReaction(userId: string, articleId: string): Promise<'upvote' | 'downvote' | null> {
    const result = await db
      .select({ type: articleReactions.type })
      .from(articleReactions)
      .where(and(eq(articleReactions.userId, userId), eq(articleReactions.articleId, articleId)))
      .limit(1);
    return result.length > 0 ? (result[0].type as 'upvote' | 'downvote') : null;
  }

  async getMultipleUserReactions(userId: string, articleIds: string[]): Promise<Record<string, 'upvote' | 'downvote'>> {
    if (articleIds.length === 0) return {};
    const reactions = await db
      .select({ articleId: articleReactions.articleId, type: articleReactions.type })
      .from(articleReactions)
      .where(and(eq(articleReactions.userId, userId), inArray(articleReactions.articleId, articleIds)));

    return reactions.reduce((acc, r) => {
      acc[r.articleId] = r.type as 'upvote' | 'downvote';
      return acc;
    }, {} as Record<string, 'upvote' | 'downvote'>);
  }
}

export const reactionService = new ReactionService();
