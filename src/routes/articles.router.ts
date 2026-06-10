import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { logger } from '../utils/logger';
import { verifyClerkToken, optionalAuth } from '../middleware/auth.middleware';
import { articleService } from '../services/article.service';
import { bookmarkService } from '../services/bookmark.service';
import { reactionService } from '../services/reaction.service';
import { commentService } from '../services/comment.service';
import { highlightService } from '../services/highlight.service';
import { groqService } from '../services/groq.service';
import { userService } from '../services/user.service';
import { streakService } from '../services/streak.service';
import { db } from '../db/client';
import { articles as articlesTable, userDismissals, userPreferences, articleReactions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getCached, setCached, deleteCached } from '../lib/redis';

const router = Router();

router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;

  if (req.user) {
    let user = await userService.getUserById(req.user.id);
    if (!user) {
      try {
        user = await userService.createOrUpdateUser({
          id: req.user.id, email: req.user.email,
          firstName: req.user.firstName, lastName: req.user.lastName,
        });
      } catch (error: any) {
        logger.warn('Could not create user:', error.message);
      }
    }

    const dismissedRows = await db.select({ articleId: userDismissals.articleId })
      .from(userDismissals).where(eq(userDismissals.userId, req.user.id));
    const excludeIds = dismissedRows.map(r => r.articleId);

    const articles = await articleService.getArticles(limit, offset, excludeIds);
    const articleIds = articles.map(a => a.id);
    const [bookmarkStatus, reactionStatus] = await Promise.all([
      bookmarkService.checkMultipleBookmarks(req.user.id, articleIds),
      reactionService.getMultipleUserReactions(req.user.id, articleIds),
    ]);

    await userService.incrementArticlesViewed(req.user.id);
    await streakService.incrementStreak(req.user.id);

    return res.json({
      success: true,
      count: articles.length,
      articles: articles.map(a => ({
        ...a,
        isBookmarked: bookmarkStatus[a.id] || false,
        userReaction: reactionStatus[a.id] || null,
      })),
      tier: 'premium',
    });
  }

  const FREE_TIER_LIMIT = 10;
  if (offset >= FREE_TIER_LIMIT) {
    return res.status(403).json({
      success: false,
      error: 'Free tier limited to first 10 articles. Please sign in to continue reading.',
      requiresAuth: true,
    });
  }

  const articlesToFetch = Math.min(limit, FREE_TIER_LIMIT - offset);
  const cacheKey = `cache:articles:free:${articlesToFetch}:${offset}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) return res.json(cached);

  const articles = await articleService.getArticles(articlesToFetch, offset);
  const freeResponse = {
    success: true,
    count: articles.length,
    articles: articles.map(a => ({ ...a, isBookmarked: false })),
    tier: 'free',
    totalAvailable: FREE_TIER_LIMIT,
  };
  await setCached(cacheKey, freeResponse, 300);
  return res.json(freeResponse);
}));

router.get('/trending', optionalAuth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;

  if (!req.user) {
    const cacheKey = `cache:trending:articles:${limit}:${offset}`;
    const cached = await getCached<object>(cacheKey);
    if (cached) return res.json(cached);
    const articles = await articleService.getTrendingArticles(limit, offset);
    const response = { success: true, count: articles.length, articles: articles.map(a => ({ ...a, isBookmarked: false })) };
    await setCached(cacheKey, response, 300);
    return res.json(response);
  }

  const articles = await articleService.getTrendingArticles(limit, offset);
  const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articles.map(a => a.id));
  return res.json({
    success: true,
    count: articles.length,
    articles: articles.map(a => ({ ...a, isBookmarked: bookmarkStatus[a.id] || false })),
  });
}));

router.get('/personalized', verifyClerkToken, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const cacheKey = `cache:personalized:${userId}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) return res.json(cached);

  const prefsRow = await db.select({ preferredCategories: userPreferences.preferredCategories })
    .from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const preferredCategories: string[] = prefsRow[0]
    ? JSON.parse(prefsRow[0].preferredCategories).map((c: string) => c.toLowerCase())
    : [];

  const upvotedRows = await db
    .select({ hashtags: articlesTable.hashtags })
    .from(articleReactions)
    .innerJoin(articlesTable, eq(articleReactions.articleId, articlesTable.id))
    .where(and(eq(articleReactions.userId, userId), eq(articleReactions.type, 'upvote')));

  const upvotedHashtags = new Set<string>();
  upvotedRows.forEach(row => {
    if (row.hashtags) {
      row.hashtags.split(/\s+/).filter((t: string) => t.startsWith('#')).forEach((t: string) => upvotedHashtags.add(t.toLowerCase()));
    }
  });

  const dismissedRows = await db.select({ articleId: userDismissals.articleId })
    .from(userDismissals).where(eq(userDismissals.userId, userId));
  const excludeIds = dismissedRows.map(r => r.articleId);
  const recent = await articleService.getRecentArticles(60, excludeIds);

  const now = Date.now();
  const scored = recent.map(article => {
    let score = 0;
    const rankReason = { categoryMatch: false, hashtagMatches: 0, hoursOld: 0, score: 0 };

    if (article.category && preferredCategories.includes(article.category.toLowerCase())) {
      score += 3; rankReason.categoryMatch = true;
    }
    if (article.hashtags && upvotedHashtags.size > 0) {
      const tags = article.hashtags.split(/\s+/).filter((t: string) => t.startsWith('#'));
      const overlap = tags.filter((t: string) => upvotedHashtags.has(t.toLowerCase())).length;
      score += overlap * 2; rankReason.hashtagMatches = overlap;
    }
    const hoursOld = (now - new Date(article.publishedAt).getTime()) / 3_600_000;
    score += 1 / (hoursOld + 1);
    rankReason.hoursOld = Math.round(hoursOld);
    rankReason.score = Math.round(score * 10) / 10;
    return { ...article, _score: score, _rankReason: rankReason };
  });

  scored.sort((a, b) => b._score - a._score);
  const top = scored.slice(0, 20);
  const articleIds = top.map(a => a.id);
  const [bookmarkStatus, reactionStatus] = await Promise.all([
    bookmarkService.checkMultipleBookmarks(userId, articleIds),
    reactionService.getMultipleUserReactions(userId, articleIds),
  ]);

  const result = top.map(({ _score, _rankReason, ...article }) => ({
    ...article,
    isBookmarked: bookmarkStatus[article.id] || false,
    userReaction: reactionStatus[article.id] || null,
    _rankReason,
  }));

  const response = { success: true, count: result.length, articles: result };
  await setCached(cacheKey, response, 300);
  return res.json(response);
}));

router.post('/:id', verifyClerkToken, asyncHandler(async (req, res) => {
  const { action } = req.body as { action: 'bookmark' | 'unbookmark' };
  if (!action || !['bookmark', 'unbookmark'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Action must be "bookmark" or "unbookmark"' });
  }
  const articleId = String(req.params.id);
  if (action === 'bookmark') {
    await bookmarkService.addBookmark(req.user!.id, articleId);
  } else {
    await bookmarkService.removeBookmark(req.user!.id, articleId);
  }
  await deleteCached(`cache:personalized:${req.user!.id}`);
  return res.json({
    success: true, action, isBookmarked: action === 'bookmark',
    message: action === 'bookmark' ? 'Article bookmarked' : 'Bookmark removed',
  });
}));

router.get('/:id/similar', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 3;
  const similar = await articleService.getSimilarArticles(String(req.params.id), limit);
  return res.json({ success: true, articles: similar });
}));

router.post('/:id/react', verifyClerkToken, asyncHandler(async (req, res) => {
  const { type } = req.body as { type: 'upvote' | 'downvote' };
  if (!type || !['upvote', 'downvote'].includes(type)) {
    return res.status(400).json({ success: false, error: 'type must be "upvote" or "downvote"' });
  }
  const result = await reactionService.reactToArticle(req.user!.id, String(req.params.id), type);
  await deleteCached(`cache:personalized:${req.user!.id}`);
  return res.json({ success: true, reaction: result.reaction });
}));

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const comments = await commentService.getComments(String(req.params.id));
  return res.json({ success: true, comments });
}));

router.post('/:id/comments', verifyClerkToken, asyncHandler(async (req, res) => {
  const { body, parentId } = req.body as { body: string; parentId?: string };
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ success: false, error: 'body is required' });
  }
  if (body.trim().length > 500) {
    return res.status(400).json({ success: false, error: 'Comment too long (max 500 chars)' });
  }
  const comment = await commentService.addComment(req.user!.id, String(req.params.id), body, parentId);
  return res.json({ success: true, comment });
}));

router.delete('/:id/comments/:commentId', verifyClerkToken, asyncHandler(async (req, res) => {
  try {
    await commentService.deleteComment(req.user!.id, String(req.params.commentId));
    return res.json({ success: true });
  } catch (error: any) {
    const status = error.message === 'Not authorized' ? 403 : error.message === 'Comment not found' ? 404 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
}));

router.get('/:id/highlights', verifyClerkToken, asyncHandler(async (req, res) => {
  const highlights = await highlightService.getHighlights(req.user!.id, String(req.params.id));
  return res.json({ success: true, highlights });
}));

router.post('/:id/highlights', verifyClerkToken, asyncHandler(async (req, res) => {
  const { text, color } = req.body as { text: string; color?: string };
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text is required' });
  }
  const highlight = await highlightService.addHighlight(req.user!.id, String(req.params.id), text, color || 'yellow');
  return res.status(201).json({ success: true, highlight });
}));

router.delete('/:id/highlights/:highlightId', verifyClerkToken, asyncHandler(async (req, res) => {
  try {
    await highlightService.deleteHighlight(req.user!.id, String(req.params.highlightId));
    return res.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes('Not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
}));

router.get('/:id/why-it-matters', verifyClerkToken, asyncHandler(async (req, res) => {
  const row = await db
    .select({ whyItMatters: articlesTable.whyItMatters, title: articlesTable.title, content: articlesTable.content })
    .from(articlesTable).where(eq(articlesTable.id, String(req.params.id))).limit(1);
  if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });
  if (row[0].whyItMatters) return res.json({ success: true, whyItMatters: row[0].whyItMatters });
  const why = await groqService.generateWhyItMatters(row[0].title, row[0].content || '');
  if (why) await articleService.updateWhyItMatters(String(req.params.id), why);
  return res.json({ success: true, whyItMatters: why || null });
}));

router.get('/:id/questions', verifyClerkToken, asyncHandler(async (req, res) => {
  const row = await db
    .select({ questions: articlesTable.questions, title: articlesTable.title, content: articlesTable.content })
    .from(articlesTable).where(eq(articlesTable.id, String(req.params.id))).limit(1);
  if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });
  if (row[0].questions) return res.json({ success: true, questions: JSON.parse(row[0].questions) });
  const questions = await groqService.generateQuestions(row[0].title, row[0].content || '');
  if (questions.length) await articleService.updateArticleQuestions(String(req.params.id), questions);
  return res.json({ success: true, questions });
}));

router.post('/:id/dismiss', verifyClerkToken, asyncHandler(async (req, res) => {
  const articleId = String(req.params.id);
  const existing = await db.select({ id: userDismissals.id })
    .from(userDismissals)
    .where(and(eq(userDismissals.userId, req.user!.id), eq(userDismissals.articleId, articleId)))
    .limit(1);
  if (!existing.length) {
    await db.insert(userDismissals).values({
      id: crypto.randomUUID(),
      userId: req.user!.id,
      articleId,
      createdAt: new Date().toISOString(),
    });
  }
  return res.json({ success: true });
}));

router.get('/:id/eli5', verifyClerkToken, asyncHandler(async (req, res) => {
  const row = await db
    .select({ eli5Summary: articlesTable.eli5Summary, title: articlesTable.title, content: articlesTable.content })
    .from(articlesTable).where(eq(articlesTable.id, String(req.params.id))).limit(1);
  if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });
  if (row[0].eli5Summary) return res.json({ success: true, eli5Summary: row[0].eli5Summary });
  const eli5 = await groqService.generateELI5(row[0].title, row[0].content || '');
  if (eli5) await articleService.updateELI5Summary(String(req.params.id), eli5);
  return res.json({ success: true, eli5Summary: eli5 || null });
}));

export default router;
