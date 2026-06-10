import { db } from '../db/client';
import { userStreaks } from '../db/schema';
import { eq } from 'drizzle-orm';

export class StreakService {
  async getOrCreateStreak(userId: string) {
    let streak = await db.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);

    if (streak.length === 0) {
      const newStreak = {
        id: crypto.randomUUID(),
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastArticleReadDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insert(userStreaks).values(newStreak);
      return newStreak;
    }

    return streak[0];
  }

  async incrementStreak(userId: string) {
    const streak = await this.getOrCreateStreak(userId);
    const today = new Date().toISOString().split('T')[0];
    const lastReadDate = streak.lastArticleReadDate?.split('T')[0];

    let newCurrentStreak = streak.currentStreak;

    // If last read was today, don't increment
    if (lastReadDate === today) {
      return streak;
    }

    // If last read was yesterday, continue the streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastReadDate === yesterdayStr) {
      newCurrentStreak = streak.currentStreak + 1;
    } else {
      // Reset streak if gap is more than 1 day
      newCurrentStreak = 1;
    }

    // Update longest streak if current exceeds it
    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    const updated = await db
      .update(userStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastArticleReadDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userStreaks.userId, userId))
      .returning();

    return updated[0];
  }

  async getUserStreak(userId: string) {
    const streak = await this.getOrCreateStreak(userId);
    
    // Calculate badges
    const badges = [];
    if (streak.currentStreak >= 7) badges.push('7-day-streak');
    if (streak.currentStreak >= 30) badges.push('30-day-streak');
    if (streak.longestStreak >= 7) badges.push('7-day-best');
    if (streak.longestStreak >= 30) badges.push('30-day-best');

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastArticleReadDate: streak.lastArticleReadDate,
      badges,
    };
  }
}

export const streakService = new StreakService();
