import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { verifyClerkToken } from '../middleware/auth.middleware';
import { articleService } from '../services/article.service';
import { db } from '../db/client';
import { apiKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { incrWithExpire } from '../lib/redis';

const router = Router();

router.post('/developer/keys', verifyClerkToken, asyncHandler(async (req, res) => {
  const existing = await db.select().from(apiKeys).where(eq(apiKeys.userId, req.user!.id)).limit(1);
  if (existing.length) {
    return res.status(409).json({ success: false, error: 'API key already exists. Delete it first to create a new one.' });
  }
  const key = `db_${crypto.randomUUID().replace(/-/g, '')}`;
  const name = (req.body.name as string)?.trim().slice(0, 80) || 'My API Key';
  const newKey = {
    id: crypto.randomUUID(),
    userId: req.user!.id,
    key, name,
    dailyLimit: 1000,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await db.insert(apiKeys).values(newKey);
  return res.status(201).json({ success: true, apiKey: newKey });
}));

router.get('/developer/keys', verifyClerkToken, asyncHandler(async (req, res) => {
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, req.user!.id));
  return res.json({ success: true, apiKeys: keys });
}));

router.delete('/developer/keys/:id', verifyClerkToken, asyncHandler(async (req, res) => {
  const keyId = String(req.params.id);
  const existing = await db.select({ userId: apiKeys.userId }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  if (!existing.length) return res.status(404).json({ success: false, error: 'Key not found' });
  if (existing[0].userId !== req.user!.id) return res.status(403).json({ success: false, error: 'Forbidden' });
  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  return res.json({ success: true });
}));

router.get('/v1/articles', asyncHandler(async (req, res) => {
  const key = req.headers['x-api-key'] as string;
  if (!key) return res.status(401).json({ success: false, error: 'Missing X-API-Key header.' });

  const keyRows = await db.select().from(apiKeys).where(eq(apiKeys.key, key)).limit(1);
  if (!keyRows.length) return res.status(401).json({ success: false, error: 'Invalid API key.' });

  const keyRecord = keyRows[0];
  const today = new Date().toISOString().split('T')[0];
  const rateKey = `apikey:rate:${key}:${today}`;
  const callCount = await incrWithExpire(rateKey, 86400);
  if (callCount > keyRecord.dailyLimit) {
    return res.status(429).json({
      success: false,
      error: `Daily limit of ${keyRecord.dailyLimit} requests exceeded. Resets at midnight UTC.`,
      limit: keyRecord.dailyLimit,
      used: callCount,
    });
  }

  db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.key, key)).catch(() => {});

  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const offset = parseInt(req.query.offset as string) || 0;
  const category = req.query.category as string | undefined;

  const articlesList = category
    ? await articleService.getArticlesByCategory(category, limit, offset)
    : await articleService.getArticles(limit, offset);

  return res.json({
    success: true,
    count: articlesList.length,
    articles: articlesList,
    rateLimit: { limit: keyRecord.dailyLimit, used: callCount, resetsAt: `${today}T23:59:59Z` },
  });
}));

export default router;
