import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config'
import { logger } from './utils/logger';
import { initializeNewsPipeline, triggerNewsPipelineManually } from './cron/news-pipeline.cron';
import { initializeNewsletterCron, triggerNewsletterManually } from './cron/newsletter.cron';
import { articleService } from './services/article.service';
import { userService } from './services/user.service';
import { bookmarkService } from './services/bookmark.service';
import { streakService } from './services/streak.service';
import { reactionService } from './services/reaction.service';
import { alertService } from './services/alert.service';
import { metricsService } from './services/metrics.service';
import { commentService } from './services/comment.service';
import { folderService } from './services/folder.service';
import { highlightService } from './services/highlight.service';
import { groqService } from './services/groq.service';
import { initializeDatabase, db } from './db/client';
import { users, articleReactions, articles as articlesTable, userPreferences } from './db/schema';
import { eq, and, inArray, gte } from 'drizzle-orm';
import { verifyClerkToken, optionalAuth } from './middleware/auth.middleware';
import { alphaVantageService } from './services/alpha-vantage.service';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api', limiter);

// Tighter rate limit for search — 15 requests per minute
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many search requests. Please wait a moment.',
});
app.use('/api/search', searchLimiter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// Endpoint: Get stock news from Alpha Vantage
app.get('/api/stock-news', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const tickers = (req.query.tickers as string)?.split(',').map(t => t.trim().toUpperCase()) || ['AAPL', 'MSFT', 'GOOGL'];

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 50',
      });
    }

    const news = await alphaVantageService.fetchStockNews(tickers, limit);

    res.json({
      success: true,
      count: news.length,
      news,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Search articles by title or hashtags
app.get('/api/search', optionalAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string)?.trim();

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Search in title and hashtags
    const articles = await articleService.searchArticles(query, limit, offset);

    // Get bookmark status if user is authenticated
    let articlesWithBookmarks = articles;
    if (req.user) {
      const articleIds = articles.map(a => a.id);
      const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articleIds);
      articlesWithBookmarks = articles.map(article => ({
        ...article,
        isBookmarked: bookmarkStatus[article.id] || false,
      }));
    } else {
      articlesWithBookmarks = articles.map(article => ({
        ...article,
        isBookmarked: false,
      }));
    }

    res.json({
      success: true,
      query,
      count: articlesWithBookmarks.length,
      articles: articlesWithBookmarks,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main endpoint: Trigger news pipeline manually
app.post('/api/trigger-pipeline', async (req: Request, res: Response) => {
  try {
    logger.info('📡 API: Manual pipeline trigger');
    await triggerNewsPipelineManually();

    res.json({
      success: true,
      message: 'Pipeline triggered successfully',
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Trigger newsletter manually (for testing)
app.post('/api/trigger-newsletter', async (req: Request, res: Response) => {
  try {
    logger.info('📡 API: Manual newsletter trigger');
    await triggerNewsletterManually();

    res.json({
      success: true,
      message: 'Newsletter triggered successfully',
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get all articles (with free tier limit) + bookmark status
app.get('/api/articles', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // If user is authenticated, they get unlimited access
    if (req.user) {
      // Auto-create user if doesn't exist
      let user = await userService.getUserById(req.user.id);
      if (!user) {
        try {
          user = await userService.createOrUpdateUser({
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
          });
        } catch (error: any) {
          logger.warn('Could not create user:', error.message);
        }
      }

      // Premium users: unlimited access
      const articles = await articleService.getArticles(limit, offset);

      // Get bookmark and reaction status for all articles in one query
      const articleIds = articles.map(a => a.id);
      const [bookmarkStatus, reactionStatus] = await Promise.all([
        bookmarkService.checkMultipleBookmarks(req.user.id, articleIds),
        reactionService.getMultipleUserReactions(req.user.id, articleIds),
      ]);

      // Attach bookmark + reaction status to articles
      const articlesWithBookmarks = articles.map(article => ({
        ...article,
        isBookmarked: bookmarkStatus[article.id] || false,
        userReaction: reactionStatus[article.id] || null,
      }));

      // Track article views and increment streak
      await userService.incrementArticlesViewed(req.user.id);
      await streakService.incrementStreak(req.user.id);

      return res.json({
        success: true,
        count: articlesWithBookmarks.length,
        articles: articlesWithBookmarks,
        tier: 'premium',
      });
    }

    // Free tier (not logged in): only first 10 articles
    const FREE_TIER_LIMIT = 10;
    
    if (offset >= FREE_TIER_LIMIT) {
      return res.status(403).json({
        success: false,
        error: 'Free tier limited to first 10 articles. Please sign in to continue reading.',
        requiresAuth: true,
      });
    }

    // Calculate how many articles we can return
    const remainingArticles = FREE_TIER_LIMIT - offset;
    const articlesToFetch = Math.min(limit, remainingArticles);
    
    const articles = await articleService.getArticles(articlesToFetch, offset);
    
    // Add isBookmarked: false for unauthenticated users
    const articlesWithBookmarks = articles.map(article => ({
      ...article,
      isBookmarked: false,
    }));

    return res.json({
      success: true,
      count: articlesWithBookmarks.length,
      articles: articlesWithBookmarks,
      tier: 'free',
      totalAvailable: FREE_TIER_LIMIT,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Unified article action (bookmark/unbookmark)
app.post('/api/articles/:id', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const articleId = req.params.id as string;
    const { action } = req.body as { action: 'bookmark' | 'unbookmark' };

    if (!action || !['bookmark', 'unbookmark'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "bookmark" or "unbookmark"',
      });
    }

    if (action === 'bookmark') {
      const result = await bookmarkService.addBookmark(req.user.id, articleId);
      return res.json({
        success: true,
        action: 'bookmark',
        isBookmarked: true,
        message: 'Article bookmarked',
      });
    } else {
      await bookmarkService.removeBookmark(req.user.id, articleId);
      return res.json({
        success: true,
        action: 'unbookmark',
        isBookmarked: false,
        message: 'Bookmark removed',
      });
    }
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Sync user from Clerk
app.post('/api/auth/sync-user', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get email from request body (sent by frontend)
    const { email, firstName, lastName } = req.body;

    try {
      const user = await userService.createOrUpdateUser({
        id: req.user.id,
        email: email || req.user.email,
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
      });

      res.json({
        success: true,
        user,
      });
    } catch (syncError: any) {
      // If user sync fails (e.g., due to old user data), just return success
      // The user is authenticated, so we don't need to block them
      logger.warn('User sync failed, but continuing:', syncError.message);
      res.json({
        success: true,
        message: 'User authenticated (sync skipped)',
      });
    }
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get current user info
app.get('/api/auth/me', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const user = await userService.getUserById(req.user.id);

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Upgrade to premium (webhook from payment provider)
app.post('/api/auth/upgrade-premium', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const user = await userService.upgradeToPremium(req.user.id);

    res.json({
      success: true,
      message: 'User upgraded to premium',
      user,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get trending articles (sorted by bookmarks) + bookmark status
app.get('/api/articles/trending', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const trendingArticles = await articleService.getTrendingArticles(limit, offset);

    // get bookmark status if user is authenticated
    let articlesWithBookmarks = trendingArticles;
    if (req.user) {
      const articleIds = trendingArticles.map(a => a.id);
      const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articleIds);
      articlesWithBookmarks = trendingArticles.map(article => ({
        ...article,
        isBookmarked: bookmarkStatus[article.id] || false,
      }));
    } else {
      articlesWithBookmarks = trendingArticles.map(article => ({
        ...article,
        isBookmarked: false,
      }));
    }

    res.json({
      success: true,
      count: articlesWithBookmarks.length,
      articles: articlesWithBookmarks,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get user's bookmarks
app.get('/api/bookmarks', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const folderId = req.query.folderId as string | undefined;

    const bookmarks = await bookmarkService.getUserBookmarks(req.user.id, limit, offset, folderId);

    // Add isBookmarked: true for all bookmarks
    const bookmarksWithStatus = bookmarks.map(bookmark => ({
      ...bookmark,
      isBookmarked: true,
    }));

    res.json({
      success: true,
      count: bookmarksWithStatus.length,
      bookmarks: bookmarksWithStatus,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Create or update user preferences
app.post('/api/auth/preferences', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { preferredCategories, preferredLanguage, fontSize, theme, notificationsEnabled, emailDigestFrequency } = req.body;

    // Validate required fields
    if (!preferredCategories || !Array.isArray(preferredCategories) || preferredCategories.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Must select exactly 3 categories',
      });
    }

    if (!preferredLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Preferred language is required',
      });
    }

    const { userPreferencesService } = await import('./services/user-preferences.service');

    try {
      // Try to create preferences
      const preferences = await userPreferencesService.createUserPreferences(req.user.id, {
        preferredCategories,
        preferredLanguage,
        fontSize: fontSize || 'medium',
        theme: theme || 'light',
        notificationsEnabled: notificationsEnabled !== false,
        emailDigestFrequency: emailDigestFrequency || 'daily',
      });

      res.json({
        success: true,
        message: 'User preferences created successfully',
        preferences,
      });
    } catch (createError: any) {
      // If preferences already exist, update them instead
      if (createError.message?.includes('already exist')) {
        const preferences = await userPreferencesService.updateUserPreferences(req.user.id, {
          preferredCategories,
          preferredLanguage,
          fontSize: fontSize || 'medium',
          theme: theme || 'light',
          notificationsEnabled: notificationsEnabled !== false,
          emailDigestFrequency: emailDigestFrequency || 'daily',
        });

        res.json({
          success: true,
          message: 'User preferences updated successfully',
          preferences,
        });
      } else {
        throw createError;
      }
    }
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get user preferences
app.get('/api/auth/preferences', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { userPreferencesService } = await import('./services/user-preferences.service');
    const preferences = await userPreferencesService.getUserPreferences(req.user.id);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'User preferences not found',
      });
    }

    // Parse JSON fields
    const parsedPreferences = {
      ...preferences,
      preferredCategories: JSON.parse(preferences.preferredCategories),
      notificationsEnabled: preferences.notificationsEnabled === 1,
    };

    res.json({
      success: true,
      preferences: parsedPreferences,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Public unsubscribe (no auth required)
app.post('/api/newsletter/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Find user by email
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!userList || userList.length === 0) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If this email exists, it has been unsubscribed',
      });
    }

    const user = userList[0];

    // Disable notifications for this user
    const { userPreferencesService } = await import('./services/user-preferences.service');
    await userPreferencesService.updateUserPreferences(user.id, {
      notificationsEnabled: false,
    });

    logger.info(`✅ User unsubscribed: ${email}`);

    res.json({
      success: true,
      message: 'You have been unsubscribed from our newsletter',
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Update user preferences
app.put('/api/auth/preferences', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { preferredCategories, preferredLanguage, fontSize, theme, notificationsEnabled, emailDigestFrequency } = req.body;

    // Validate categories if provided
    if (preferredCategories && (!Array.isArray(preferredCategories) || preferredCategories.length !== 3)) {
      return res.status(400).json({
        success: false,
        error: 'Must select exactly 3 categories',
      });
    }

    const { userPreferencesService } = await import('./services/user-preferences.service');

    const preferences = await userPreferencesService.updateUserPreferences(req.user.id, {
      preferredCategories,
      preferredLanguage,
      fontSize,
      theme,
      notificationsEnabled,
      emailDigestFrequency,
    });

    // Parse JSON fields
    const parsedPreferences = {
      ...preferences,
      preferredCategories: JSON.parse(preferences.preferredCategories),
      notificationsEnabled: preferences.notificationsEnabled === 1,
    };

    res.json({
      success: true,
      message: 'User preferences updated successfully',
      preferences: parsedPreferences,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Get user streak
app.get('/api/auth/streak', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const streak = await streakService.getUserStreak(req.user.id);

    res.json({
      success: true,
      streak,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: React to an article (upvote/downvote)
app.post('/api/articles/:id/react', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const articleId = req.params.id as string;
    const { type } = req.body as { type: 'upvote' | 'downvote' };

    if (!type || !['upvote', 'downvote'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be "upvote" or "downvote"' });
    }

    const result = await reactionService.reactToArticle(req.user.id, articleId, type);
    return res.json({ success: true, reaction: result.reaction });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Get similar articles by hashtag overlap
app.get('/api/articles/:id/similar', async (req: Request, res: Response) => {
  try {
    const articleId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 3;
    const similar = await articleService.getSimilarArticles(articleId, limit);
    return res.json({ success: true, articles: similar });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Get user keyword alerts
app.get('/api/auth/alerts', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const alerts = await alertService.getUserAlerts(req.user.id);
    return res.json({ success: true, alerts });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Create keyword alert
app.post('/api/auth/alerts', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { keyword } = req.body as { keyword: string };
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ success: false, error: 'keyword is required' });
    }
    const alert = await alertService.createAlert(req.user.id, keyword);
    return res.json({ success: true, alert });
  } catch (error: any) {
    const status = error.message.includes('Maximum') || error.message.includes('already exists') ? 400 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
});

// Endpoint: Personalized article feed (ML-style weighted scoring)
app.get('/api/articles/personalized', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const userId = req.user.id;

    // 1. Get user's preferred categories
    const prefsRow = await db.select({ preferredCategories: userPreferences.preferredCategories })
      .from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const preferredCategories: string[] = prefsRow[0]
      ? JSON.parse(prefsRow[0].preferredCategories).map((c: string) => c.toLowerCase())
      : [];

    // 2. Get hashtags from articles user has upvoted
    const upvotedRows = await db
      .select({ hashtags: articlesTable.hashtags })
      .from(articleReactions)
      .innerJoin(articlesTable, eq(articleReactions.articleId, articlesTable.id))
      .where(and(eq(articleReactions.userId, userId), eq(articleReactions.type, 'upvote')));

    const upvotedHashtags = new Set<string>();
    upvotedRows.forEach(row => {
      if (row.hashtags) {
        row.hashtags.split(/\s+/).filter((t: string) => t.startsWith('#'))
          .forEach((t: string) => upvotedHashtags.add(t.toLowerCase()));
      }
    });

    // 3. Fetch recent articles (last 7 days)
    const recent = await articleService.getRecentArticles(60);

    // 4. Score each article with reasons
    const now = Date.now();
    const scored = recent.map(article => {
      let score = 0;
      const rankReason = { categoryMatch: false, hashtagMatches: 0, hoursOld: 0, score: 0 };

      if (article.category && preferredCategories.includes(article.category.toLowerCase())) {
        score += 3;
        rankReason.categoryMatch = true;
      }

      if (article.hashtags && upvotedHashtags.size > 0) {
        const tags = article.hashtags.split(/\s+/).filter((t: string) => t.startsWith('#'));
        const overlap = tags.filter((t: string) => upvotedHashtags.has(t.toLowerCase())).length;
        score += overlap * 2;
        rankReason.hashtagMatches = overlap;
      }

      const hoursOld = (now - new Date(article.publishedAt).getTime()) / 3_600_000;
      score += 1 / (hoursOld + 1);
      rankReason.hoursOld = Math.round(hoursOld);
      rankReason.score = Math.round(score * 10) / 10;

      return { ...article, _score: score, _rankReason: rankReason };
    });

    scored.sort((a, b) => b._score - a._score);
    const top = scored.slice(0, 20);

    // 5. Attach bookmark + reaction status
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

    return res.json({ success: true, count: result.length, articles: result });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Observability metrics dashboard data
app.get('/api/metrics', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const metrics = await metricsService.getDashboardMetrics();
    return res.json({ success: true, metrics });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Delete keyword alert
app.delete('/api/auth/alerts/:alertId', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await alertService.deleteAlert(req.user.id, req.params.alertId as string);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Get notifications
app.get('/api/notifications', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const notifs = await alertService.getNotifications(req.user.id);
    return res.json({ success: true, notifications: notifs });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Get unread notification count
app.get('/api/notifications/unread-count', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const count = await alertService.getUnreadCount(req.user.id);
    return res.json({ success: true, count });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Mark all notifications read
app.post('/api/notifications/read-all', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await alertService.markAllRead(req.user.id);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Mark single notification read
app.post('/api/notifications/:id/read', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await alertService.markOneRead(req.user.id, req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Delete notification
app.delete('/api/notifications/:id', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await alertService.deleteNotification(req.user.id, req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Trending Hashtags ─────────────────────────────────────────────────────────

app.get('/api/trending-hashtags', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 48;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const rows = await db
      .select({ hashtags: articlesTable.hashtags })
      .from(articlesTable)
      .where(gte(articlesTable.publishedAt, since));

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

    return res.json({ success: true, trending, hours });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

app.get('/api/articles/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await commentService.getComments(req.params.id as string);
    return res.json({ success: true, comments });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/articles/:id/comments', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { body, parentId } = req.body as { body: string; parentId?: string };
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }
    if (body.trim().length > 500) {
      return res.status(400).json({ success: false, error: 'Comment too long (max 500 chars)' });
    }
    const comment = await commentService.addComment(req.user.id, req.params.id as string, body, parentId);
    return res.json({ success: true, comment });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/articles/:id/comments/:commentId', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await commentService.deleteComment(req.user.id, req.params.commentId as string);
    return res.json({ success: true });
  } catch (error: any) {
    const status = error.message === 'Not authorized' ? 403 : error.message === 'Comment not found' ? 404 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
});

// ── Bookmark Folders ──────────────────────────────────────────────────────────

app.get('/api/folders', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const folders = await folderService.getFolders(req.user.id);
    return res.json({ success: true, folders });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/folders', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { name } = req.body as { name: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ success: false, error: 'Folder name too long (max 50 chars)' });
    }
    const folder = await folderService.createFolder(req.user.id, name);
    return res.json({ success: true, folder });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/folders/:id', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await folderService.deleteFolder(req.user.id, req.params.id as string);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/bookmarks/:articleId/folder', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { folderId } = req.body as { folderId: string | null };
    await folderService.assignToFolder(req.user.id, req.params.articleId as string, folderId ?? null);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Highlights ────────────────────────────────────────────────────────────────

app.get('/api/articles/:id/highlights', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const highlights = await highlightService.getHighlights(req.user.id, req.params.id as string);
    return res.json({ success: true, highlights });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/articles/:id/highlights', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { text, color } = req.body as { text: string; color?: string };
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    const highlight = await highlightService.addHighlight(req.user.id, req.params.id as string, text, color || 'yellow');
    return res.status(201).json({ success: true, highlight });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/articles/:id/highlights/:highlightId', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await highlightService.deleteHighlight(req.user.id, req.params.highlightId as string);
    return res.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes('Not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
});

// ── Why It Matters (on-demand) ────────────────────────────────────────────────

app.get('/api/articles/:id/why-it-matters', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const row = await db.select({ whyItMatters: articlesTable.whyItMatters, title: articlesTable.title, content: articlesTable.content })
      .from(articlesTable)
      .where(eq(articlesTable.id, req.params.id as string))
      .limit(1);
    if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });

    if (row[0].whyItMatters) {
      return res.json({ success: true, whyItMatters: row[0].whyItMatters });
    }

    const why = await groqService.generateWhyItMatters(row[0].title, row[0].content || '');
    if (why) {
      await articleService.updateWhyItMatters(req.params.id as string, why);
    }
    return res.json({ success: true, whyItMatters: why || null });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/articles/:id/questions', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const row = await db.select({ questions: articlesTable.questions, title: articlesTable.title, content: articlesTable.content })
      .from(articlesTable)
      .where(eq(articlesTable.id, req.params.id as string))
      .limit(1);
    if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });

    if (row[0].questions) {
      return res.json({ success: true, questions: JSON.parse(row[0].questions) });
    }

    const questions = await groqService.generateQuestions(row[0].title, row[0].content || '');
    if (questions.length) {
      await articleService.updateArticleQuestions(req.params.id as string, questions);
    }
    return res.json({ success: true, questions });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
const PORT = config.server.port;

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.nodeEnv}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);

  // Initialize database connection
  const dbConnected = await initializeDatabase();
  
  if (!dbConnected) {
    logger.warn('⚠️  Database connection failed. Running in API-only mode (no cron jobs or persistence).');
    logger.warn('💡 Tip: You can still test API endpoints, but data won\'t be saved.');
  } else {
    // Initialize cron jobs only if database is ready
    initializeNewsPipeline();
    initializeNewsletterCron();
  }
});