import { db } from '../db/client';
import { userAlerts, articles, notifications } from '../db/schema';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { logger } from '../utils/logger';

const MAX_ALERTS_PER_USER = 10;
const sentAlertKeys = new Set<string>();

function sanitizeKeyword(raw: string): string {
  return raw
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 50);
}

class AlertService {
  async createAlert(userId: string, rawKeyword: string) {
    const keyword = sanitizeKeyword(rawKeyword);

    if (keyword.length < 2) {
      throw new Error('Keyword must be at least 2 characters after sanitization');
    }

    const existing = await db
      .select()
      .from(userAlerts)
      .where(and(eq(userAlerts.userId, userId), eq(userAlerts.isActive, 1)));

    if (existing.length >= MAX_ALERTS_PER_USER) {
      throw new Error(`Maximum ${MAX_ALERTS_PER_USER} keyword alerts allowed`);
    }

    if (existing.some(a => a.keyword.toLowerCase() === keyword.toLowerCase())) {
      throw new Error('Alert for this keyword already exists');
    }

    const id = crypto.randomUUID();
    await db.insert(userAlerts).values({
      id,
      userId,
      keyword,
      isActive: 1,
      createdAt: new Date().toISOString(),
    });

    return { id, keyword };
  }

  async getUserAlerts(userId: string) {
    return db
      .select()
      .from(userAlerts)
      .where(and(eq(userAlerts.userId, userId), eq(userAlerts.isActive, 1)))
      .orderBy(desc(userAlerts.createdAt));
  }

  async deleteAlert(userId: string, alertId: string) {
    await db
      .update(userAlerts)
      .set({ isActive: 0 })
      .where(and(eq(userAlerts.id, alertId), eq(userAlerts.userId, userId)));
  }

  async checkRecentArticles() {
    const recent = await db
      .select({ id: articles.id, title: articles.title, url: articles.url })
      .from(articles)
      .where(sql`datetime(${articles.publishedAt}) > datetime('now', '-3 hours')`)
      .limit(50);

    await this.checkNewArticles(recent);
  }

  async checkNewArticles(newArticles: Array<{ id: string; title: string; url: string }>) {
    if (newArticles.length === 0) return;

    const allAlerts = await db
      .select({ id: userAlerts.id, userId: userAlerts.userId, keyword: userAlerts.keyword })
      .from(userAlerts)
      .where(eq(userAlerts.isActive, 1));

    if (allAlerts.length === 0) return;

    const byUser = allAlerts.reduce((acc, alert) => {
      if (!acc[alert.userId]) acc[alert.userId] = [];
      acc[alert.userId].push({ id: alert.id, keyword: alert.keyword });
      return acc;
    }, {} as Record<string, Array<{ id: string; keyword: string }>>);

    for (const [userId, alerts] of Object.entries(byUser)) {
      for (const alert of alerts) {
        const kw = alert.keyword.toLowerCase();
        for (const article of newArticles) {
          const key = `${userId}:${article.id}:${alert.id}`;
          if (sentAlertKeys.has(key)) continue;
          if (!article.title.toLowerCase().includes(kw)) continue;

          sentAlertKeys.add(key);
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            userId,
            alertId: alert.id,
            articleId: article.id,
            articleTitle: article.title,
            articleUrl: article.url,
            keyword: alert.keyword,
            read: 0,
            createdAt: new Date().toISOString(),
          });
          logger.info(`Notification saved for user ${userId}: keyword "${alert.keyword}" matched "${article.title}"`);
        }
      }
    }
  }

  // --- Notification queries ---

  async getNotifications(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
    return rows[0]?.count ?? 0;
  }

  async markAllRead(userId: string) {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  }

  async markOneRead(userId: string, notificationId: string) {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async deleteNotification(userId: string, notificationId: string) {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }
}

export const alertService = new AlertService();
