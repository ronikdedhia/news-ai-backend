import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { logger } from '../utils/logger';
import { verifyClerkToken, optionalAuth } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { streakService } from '../services/streak.service';
import { alertService } from '../services/alert.service';
import { groqService } from '../services/groq.service';
import { db } from '../db/client';
import { users, articleReactions, articles as articlesTable, userPreferences, userBookmarks, userStreaks } from '../db/schema';
import { eq, and, gte, sql as drizzleSql } from 'drizzle-orm';
import { getCached, setCached } from '../lib/redis';

const router = Router();

router.post('/sync-user', verifyClerkToken, asyncHandler(async (req, res) => {
  const { email, firstName, lastName } = req.body;
  try {
    const user = await userService.createOrUpdateUser({
      id: req.user!.id,
      email: email || req.user!.email,
      firstName: firstName || req.user!.firstName,
      lastName: lastName || req.user!.lastName,
    });
    await db.update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, req.user!.id));
    res.json({ success: true, user });
  } catch (syncError: any) {
    logger.warn('User sync failed, but continuing:', syncError.message);
    res.json({ success: true, message: 'User authenticated (sync skipped)' });
  }
}));

router.get('/me', optionalAuth, asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'User not authenticated' });
  const user = await userService.getUserById(req.user.id);
  return res.json({ success: true, user });
}));

router.post('/upgrade-premium', verifyClerkToken, asyncHandler(async (req, res) => {
  const user = await userService.upgradeToPremium(req.user!.id);
  return res.json({ success: true, message: 'User upgraded to premium', user });
}));

router.post('/preferences', verifyClerkToken, asyncHandler(async (req, res) => {
  const { preferredCategories, preferredLanguage, fontSize, theme, notificationsEnabled, emailDigestFrequency } = req.body;

  if (!preferredCategories || !Array.isArray(preferredCategories) || preferredCategories.length !== 3) {
    return res.status(400).json({ success: false, error: 'Must select exactly 3 categories' });
  }
  if (!preferredLanguage) {
    return res.status(400).json({ success: false, error: 'Preferred language is required' });
  }

  const { userPreferencesService } = await import('../services/user-preferences.service');
  try {
    const preferences = await userPreferencesService.createUserPreferences(req.user!.id, {
      preferredCategories, preferredLanguage,
      fontSize: fontSize || 'medium', theme: theme || 'light',
      notificationsEnabled: notificationsEnabled !== false,
      emailDigestFrequency: emailDigestFrequency || 'daily',
    });
    return res.json({ success: true, message: 'User preferences created successfully', preferences });
  } catch (createError: any) {
    if (createError.message?.includes('already exist')) {
      const preferences = await userPreferencesService.updateUserPreferences(req.user!.id, {
        preferredCategories, preferredLanguage,
        fontSize: fontSize || 'medium', theme: theme || 'light',
        notificationsEnabled: notificationsEnabled !== false,
        emailDigestFrequency: emailDigestFrequency || 'daily',
      });
      return res.json({ success: true, message: 'User preferences updated successfully', preferences });
    }
    throw createError;
  }
}));

router.get('/preferences', verifyClerkToken, asyncHandler(async (req, res) => {
  const { userPreferencesService } = await import('../services/user-preferences.service');
  const preferences = await userPreferencesService.getUserPreferences(req.user!.id);
  if (!preferences) return res.status(404).json({ success: false, error: 'User preferences not found' });
  return res.json({
    success: true,
    preferences: {
      ...preferences,
      preferredCategories: JSON.parse(preferences.preferredCategories),
      notificationsEnabled: preferences.notificationsEnabled === 1,
    },
  });
}));

router.put('/preferences', verifyClerkToken, asyncHandler(async (req, res) => {
  const { preferredCategories, preferredLanguage, fontSize, theme, notificationsEnabled, emailDigestFrequency } = req.body;
  if (preferredCategories && (!Array.isArray(preferredCategories) || preferredCategories.length !== 3)) {
    return res.status(400).json({ success: false, error: 'Must select exactly 3 categories' });
  }
  const { userPreferencesService } = await import('../services/user-preferences.service');
  const preferences = await userPreferencesService.updateUserPreferences(req.user!.id, {
    preferredCategories, preferredLanguage, fontSize, theme, notificationsEnabled, emailDigestFrequency,
  });
  return res.json({
    success: true,
    message: 'User preferences updated successfully',
    preferences: {
      ...preferences,
      preferredCategories: JSON.parse(preferences.preferredCategories),
      notificationsEnabled: preferences.notificationsEnabled === 1,
    },
  });
}));

router.get('/streak', verifyClerkToken, asyncHandler(async (req, res) => {
  const streak = await streakService.getUserStreak(req.user!.id);
  return res.json({ success: true, streak });
}));

router.get('/alerts', verifyClerkToken, asyncHandler(async (req, res) => {
  const alerts = await alertService.getUserAlerts(req.user!.id);
  return res.json({ success: true, alerts });
}));

router.post('/alerts', verifyClerkToken, asyncHandler(async (req, res) => {
  const { keyword } = req.body as { keyword: string };
  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ success: false, error: 'keyword is required' });
  }
  try {
    const alert = await alertService.createAlert(req.user!.id, keyword);
    return res.json({ success: true, alert });
  } catch (error: any) {
    const status = error.message.includes('Maximum') || error.message.includes('already exists') ? 400 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
}));

router.delete('/alerts/:alertId', verifyClerkToken, asyncHandler(async (req, res) => {
  await alertService.deleteAlert(req.user!.id, String(req.params.alertId));
  return res.json({ success: true });
}));

router.get('/weekly-wrap', verifyClerkToken, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const cacheKey = `cache:weekly-wrap:${userId}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) return res.json(cached);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [userRow, streakRow, reactionsThisWeek, bookmarksThisWeek] = await Promise.all([
    db.select({ articlesViewedCount: users.articlesViewedCount, firstName: users.firstName })
      .from(users).where(eq(users.id, userId)).limit(1),
    db.select({ currentStreak: userStreaks.currentStreak })
      .from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1),
    db.select({ category: articlesTable.category, hashtags: articlesTable.hashtags })
      .from(articleReactions)
      .innerJoin(articlesTable, eq(articleReactions.articleId, articlesTable.id))
      .where(and(eq(articleReactions.userId, userId), gte(articleReactions.createdAt, weekAgo))),
    db.select({ count: drizzleSql<number>`count(*)` })
      .from(userBookmarks)
      .where(and(eq(userBookmarks.userId, userId), gte(userBookmarks.createdAt, weekAgo))),
  ]);

  const catCounts: Record<string, number> = {};
  for (const r of reactionsThisWeek) {
    if (r.category) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const tagCounts: Record<string, number> = {};
  for (const r of reactionsThisWeek) {
    if (r.hashtags) {
      r.hashtags.split(/\s+/).filter((t: string) => t.startsWith('#')).forEach((t: string) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  }
  const topHashtag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const wrapResponse = {
    success: true,
    wrap: {
      articlesViewed: userRow[0]?.articlesViewedCount || 0,
      streak: streakRow[0]?.currentStreak || 0,
      topCategory, topHashtag,
      reactionsThisWeek: reactionsThisWeek.length,
      bookmarksThisWeek: Number(bookmarksThisWeek[0]?.count) || 0,
      firstName: userRow[0]?.firstName || null,
    },
  };
  await setCached(cacheKey, wrapResponse, 1800);
  return res.json(wrapResponse);
}));

router.get('/catchup-brief', verifyClerkToken, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const userRow = await db.select({ lastLoginAt: users.lastLoginAt })
    .from(users).where(eq(users.id, userId)).limit(1);

  const lastLogin = userRow[0]?.lastLoginAt;
  const now = new Date();
  const hoursSince = lastLogin
    ? (now.getTime() - new Date(lastLogin).getTime()) / 3_600_000
    : Infinity;

  if (hoursSince < 24) return res.json({ success: true, shouldShow: false });

  const since = lastLogin ?? new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const newArticles = await db
    .select({ id: articlesTable.id, title: articlesTable.title })
    .from(articlesTable)
    .where(gte(articlesTable.publishedAt, since))
    .orderBy(articlesTable.upvoteCount)
    .limit(50);

  await db.update(users).set({ lastLoginAt: now.toISOString() }).where(eq(users.id, userId));

  if (newArticles.length === 0) return res.json({ success: true, shouldShow: false });

  const summary = await groqService.generateCatchUpBrief(newArticles.slice(0, 5).map(a => a.title));
  return res.json({
    success: true, shouldShow: true,
    count: newArticles.length, summary, since,
    hoursAway: Math.round(hoursSince),
  });
}));

export default router;
