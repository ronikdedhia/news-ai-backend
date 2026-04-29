import { randomUUID } from 'crypto';
import { db } from '../db/client';
import { articleHighlights } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const VALID_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;

class HighlightService {
  async getHighlights(userId: string, articleId: string) {
    return db
      .select()
      .from(articleHighlights)
      .where(and(eq(articleHighlights.userId, userId), eq(articleHighlights.articleId, articleId)));
  }

  async addHighlight(userId: string, articleId: string, text: string, color: string) {
    const safeColor = VALID_COLORS.includes(color as any) ? color : 'yellow';
    const sanitizedText = text.trim().slice(0, 300);
    if (!sanitizedText) throw new Error('text is required');

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.insert(articleHighlights).values({ id, userId, articleId, text: sanitizedText, color: safeColor, createdAt });
    return { id, userId, articleId, text: sanitizedText, color: safeColor, createdAt };
  }

  async deleteHighlight(userId: string, highlightId: string) {
    const rows = await db
      .select()
      .from(articleHighlights)
      .where(and(eq(articleHighlights.id, highlightId), eq(articleHighlights.userId, userId)))
      .limit(1);
    if (!rows.length) throw new Error('Not found or not authorized');
    await db.delete(articleHighlights).where(eq(articleHighlights.id, highlightId));
  }
}

export const highlightService = new HighlightService();
