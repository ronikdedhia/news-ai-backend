import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { verifyClerkToken, optionalAuth } from '../middleware/auth.middleware';
import { articleService } from '../services/article.service';
import { bookmarkService } from '../services/bookmark.service';
import { metricsService } from '../services/metrics.service';
import { ttsService } from '../services/tts.service';
import { alphaVantageService } from '../services/alpha-vantage.service';
import { embedText } from '../services/embedding.service';
import { db } from '../db/client';
import { articles as articlesTable, users } from '../db/schema';
import { gte, eq } from 'drizzle-orm';
import { getCached, setCached } from '../lib/redis';

const router = Router();

router.get('/stock-news', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const tickers = (req.query.tickers as string)?.split(',').map(t => t.trim().toUpperCase()) || ['AAPL', 'MSFT', 'GOOGL'];

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, error: 'Limit must be between 1 and 50' });
  }

  const cacheKey = `cache:stock:${tickers.sort().join(',')}:${limit}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) return res.json(cached);

  const news = await alphaVantageService.fetchStockNews(tickers, limit);
  const response = { success: true, count: news.length, news };
  await setCached(cacheKey, response, 900);
  return res.json(response);
}));

router.get('/search', optionalAuth, asyncHandler(async (req, res) => {
  const query = (req.query.q as string)?.trim();
  const mode = (req.query.mode as string) || 'keyword';

  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
  }

  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  let articles: any[];
  if (mode === 'semantic') {
    const cacheKey = `cache:search:semantic:${query.toLowerCase()}:${limit}`;
    const cachedSemantic = await getCached<any[]>(cacheKey);
    if (cachedSemantic) {
      articles = cachedSemantic;
    } else {
      const embedding = await embedText(query);
      articles = await articleService.semanticSearch(embedding, limit);
      await setCached(cacheKey, articles, 300);
    }
  } else {
    articles = await articleService.searchArticles(query, limit, offset);
  }

  let articlesWithBookmarks = articles;
  if (req.user) {
    const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articles.map((a: any) => a.id));
    articlesWithBookmarks = articles.map((a: any) => ({ ...a, isBookmarked: bookmarkStatus[a.id] || false }));
  } else {
    articlesWithBookmarks = articles.map((a: any) => ({ ...a, isBookmarked: false }));
  }

  return res.json({ success: true, query, mode, count: articlesWithBookmarks.length, articles: articlesWithBookmarks });
}));

router.get('/trending-hashtags', asyncHandler(async (req, res) => {
  const hours = parseInt(req.query.hours as string) || 48;
  const cacheKey = `cache:hashtags:${hours}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) return res.json(cached);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await db.select({ hashtags: articlesTable.hashtags })
    .from(articlesTable).where(gte(articlesTable.publishedAt, since));

  const counts = new Map<string, number>();
  rows.forEach(row => {
    if (!row.hashtags) return;
    row.hashtags.split(/\s+/).filter(t => t.startsWith('#')).forEach(tag => {
      const lower = tag.toLowerCase();
      counts.set(lower, (counts.get(lower) || 0) + 1);
    });
  });

  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  const response = { success: true, trending, hours };
  await setCached(cacheKey, response, 600);
  return res.json(response);
}));

router.get('/metrics', verifyClerkToken, asyncHandler(async (req, res) => {
  const cached = await getCached<object>('cache:metrics');
  if (cached) return res.json(cached);
  const metrics = await metricsService.getDashboardMetrics();
  const response = { success: true, metrics };
  await setCached('cache:metrics', response, 300);
  return res.json(response);
}));

router.post('/tts', verifyClerkToken, asyncHandler(async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text is required' });
  }
  const audio = await ttsService.synthesize(text);
  res.set('Content-Type', 'audio/mpeg');
  res.set('Content-Length', String(audio.length));
  res.send(audio);
}));

router.post('/newsletter/unsubscribe', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  const userList = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userList || userList.length === 0) {
    return res.json({ success: true, message: 'If this email exists, it has been unsubscribed' });
  }

  const { userPreferencesService } = await import('../services/user-preferences.service');
  await userPreferencesService.updateUserPreferences(userList[0].id, { notificationsEnabled: false });
  return res.json({ success: true, message: 'You have been unsubscribed from our newsletter' });
}));

export default router;
