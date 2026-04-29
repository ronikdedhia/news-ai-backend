import { db } from '../db/client';
import { articles, users, pipelineRuns, articleReactions, userAlerts } from '../db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';

class MetricsService {
  async getDashboardMetrics() {
    const [
      totalArticlesRow,
      totalUsersRow,
      totalUpvotesRow,
      categoryBreakdown,
      sentimentBreakdown,
      recentRuns,
      topArticles,
      alertsRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(articles),
      db.select({ count: sql<number>`COUNT(*)` }).from(users),
      db.select({ total: sql<number>`SUM(upvote_count)` }).from(articles),
      db.select({
        category: articles.category,
        count: sql<number>`COUNT(*)`,
      })
        .from(articles)
        .groupBy(articles.category)
        .orderBy(desc(sql`COUNT(*)`)),
      db.select({
        sentiment: articles.sentiment,
        count: sql<number>`COUNT(*)`,
      })
        .from(articles)
        .where(sql`sentiment IS NOT NULL`)
        .groupBy(articles.sentiment),
      db.select()
        .from(pipelineRuns)
        .orderBy(desc(pipelineRuns.startedAt))
        .limit(20),
      db.select({
        id: articles.id,
        title: articles.title,
        upvoteCount: articles.upvoteCount,
        category: articles.category,
      })
        .from(articles)
        .orderBy(desc(articles.upvoteCount))
        .limit(5),
      db.select({ count: sql<number>`COUNT(*)` }).from(userAlerts).where(eq(userAlerts.isActive, 1)),
    ]);

    const successRuns = recentRuns.filter(r => r.status === 'success').length;
    const successRate = recentRuns.length > 0
      ? Math.round((successRuns / recentRuns.length) * 100)
      : 0;

    return {
      totals: {
        articles: totalArticlesRow[0]?.count ?? 0,
        users: totalUsersRow[0]?.count ?? 0,
        upvotes: totalUpvotesRow[0]?.total ?? 0,
        activeAlerts: alertsRow[0]?.count ?? 0,
      },
      categoryBreakdown: categoryBreakdown.filter(r => r.category),
      sentimentBreakdown,
      recentRuns,
      topArticles,
      pipelineSuccessRate: successRate,
    };
  }

  async recordRunStart(source: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(pipelineRuns).values({
      id,
      source,
      status: 'running',
      processed: 0,
      saved: 0,
      errors: 0,
      telegramSent: 0,
      startedAt: new Date().toISOString(),
    });
    return id;
  }

  async recordRunComplete(
    runId: string,
    result: { processed: number; saved: number; errors: number; telegramSent: number },
    startedAt: number
  ) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    await db.update(pipelineRuns)
      .set({
        status: result.errors > 0 && result.saved === 0 ? 'failed' : 'success',
        processed: result.processed,
        saved: result.saved,
        errors: result.errors,
        telegramSent: result.telegramSent,
        completedAt,
        durationMs,
      })
      .where(eq(pipelineRuns.id, runId));
  }

  async recordRunFailed(runId: string, startedAt: number) {
    await db.update(pipelineRuns)
      .set({
        status: 'failed',
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      })
      .where(eq(pipelineRuns.id, runId));
  }
}

export const metricsService = new MetricsService();
