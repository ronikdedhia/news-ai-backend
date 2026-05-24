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
import { users, articleReactions, articles as articlesTable, userPreferences, userDismissals, userBookmarks, userStreaks, apiKeys } from './db/schema';
import { getCached, setCached, deleteCached, incrWithExpire } from './lib/redis';
import { eq, and, inArray, gte, sql as drizzleSql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { verifyClerkToken, optionalAuth } from './middleware/auth.middleware';
import { alphaVantageService } from './services/alpha-vantage.service';
import { ttsService } from './services/tts.service';
import { embedText, warmupEmbedder } from './services/embedding.service';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));
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

    // Alpha Vantage free = 25 req/day — always cache aggressively
    const stockCacheKey = `cache:stock:${tickers.sort().join(',')}:${limit}`;
    const cachedStock = await getCached<object>(stockCacheKey);
    if (cachedStock) return res.json(cachedStock);

    const news = await alphaVantageService.fetchStockNews(tickers, limit);

    const stockResponse = { success: true, count: news.length, news };
    await setCached(stockCacheKey, stockResponse, 900); // 15 min
    res.json(stockResponse);
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Search articles — keyword (default) or semantic (?mode=semantic)
app.get('/api/search', optionalAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string)?.trim();
    const mode = (req.query.mode as string) || 'keyword';

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let articles: any[];
    if (mode === 'semantic') {
      const semanticCacheKey = `cache:search:semantic:${query.toLowerCase()}:${limit}`;
      const cachedSemantic = await getCached<any[]>(semanticCacheKey);
      if (cachedSemantic) {
        articles = cachedSemantic;
      } else {
        const embedding = await embedText(query);
        articles = await articleService.semanticSearch(embedding, limit);
        await setCached(semanticCacheKey, articles, 300);
      }
    } else {
      articles = await articleService.searchArticles(query, limit, offset);
    }

    // Get bookmark status if user is authenticated
    let articlesWithBookmarks = articles;
    if (req.user) {
      const articleIds = articles.map((a: any) => a.id);
      const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articleIds);
      articlesWithBookmarks = articles.map((article: any) => ({
        ...article,
        isBookmarked: bookmarkStatus[article.id] || false,
      }));
    } else {
      articlesWithBookmarks = articles.map((article: any) => ({
        ...article,
        isBookmarked: false,
      }));
    }

    res.json({
      success: true,
      query,
      mode,
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

// Main endpoint: Trigger news pipeline manually (protected by PIPELINE_SECRET)
app.post('/api/trigger-pipeline', async (req: Request, res: Response) => {
  const secret = req.headers['x-pipeline-secret'] || req.body?.secret;
  if (!process.env.PIPELINE_SECRET || secret !== process.env.PIPELINE_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    logger.info('📡 API: Manual pipeline trigger');
    await triggerNewsPipelineManually();
    await deleteCached(
      'cache:articles:free',
      'cache:trending',
      'cache:hashtags',
      'cache:trending:articles:10:0',
      'cache:metrics',
    );

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

// Endpoint: Trigger newsletter manually (protected by PIPELINE_SECRET)
app.post('/api/trigger-newsletter', async (req: Request, res: Response) => {
  const secret = req.headers['x-pipeline-secret'] || req.body?.secret;
  if (!process.env.PIPELINE_SECRET || secret !== process.env.PIPELINE_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
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

      // Fetch dismissed article IDs to exclude from feed
      const dismissedRows = await db.select({ articleId: userDismissals.articleId })
        .from(userDismissals).where(eq(userDismissals.userId, req.user.id));
      const excludeIds = dismissedRows.map(r => r.articleId);

      // Premium users: unlimited access (excluding dismissed)
      const articles = await articleService.getArticles(limit, offset, excludeIds);

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

    const cacheKey = `cache:articles:free:${articlesToFetch}:${offset}`;
    const cached = await getCached<object>(cacheKey);
    if (cached) return res.json(cached);

    const articles = await articleService.getArticles(articlesToFetch, offset);

    // Add isBookmarked: false for unauthenticated users
    const articlesWithBookmarks = articles.map(article => ({
      ...article,
      isBookmarked: false,
    }));

    const freeResponse = {
      success: true,
      count: articlesWithBookmarks.length,
      articles: articlesWithBookmarks,
      tier: 'free',
      totalAvailable: FREE_TIER_LIMIT,
    };
    await setCached(cacheKey, freeResponse, 300);
    return res.json(freeResponse);
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
      await bookmarkService.addBookmark(req.user.id, articleId);
      await deleteCached(`cache:personalized:${req.user.id}`);
      return res.json({
        success: true,
        action: 'bookmark',
        isBookmarked: true,
        message: 'Article bookmarked',
      });
    } else {
      await bookmarkService.removeBookmark(req.user.id, articleId);
      await deleteCached(`cache:personalized:${req.user.id}`);
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

      // Update lastLoginAt on every sign-in sync
      await db.update(users)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(users.id, req.user.id));

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

    // Cache unauthenticated trending (bookmark status is always false, safe to cache globally)
    if (!req.user) {
      const trendingCacheKey = `cache:trending:articles:${limit}:${offset}`;
      const cachedTrending = await getCached<object>(trendingCacheKey);
      if (cachedTrending) return res.json(cachedTrending);

      const trendingArticles = await articleService.getTrendingArticles(limit, offset);
      const articlesWithBookmarks = trendingArticles.map(a => ({ ...a, isBookmarked: false }));
      const trendingResponse = { success: true, count: articlesWithBookmarks.length, articles: articlesWithBookmarks };
      await setCached(trendingCacheKey, trendingResponse, 300);
      return res.json(trendingResponse);
    }

    const trendingArticles = await articleService.getTrendingArticles(limit, offset);

    // get bookmark status if user is authenticated
    const articleIds = trendingArticles.map(a => a.id);
    const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articleIds);
    const articlesWithBookmarks = trendingArticles.map(article => ({
      ...article,
      isBookmarked: bookmarkStatus[article.id] || false,
    }));

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
    await deleteCached(`cache:personalized:${req.user.id}`);
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

    const personalizedCacheKey = `cache:personalized:${userId}`;
    const cachedPersonalized = await getCached<object>(personalizedCacheKey);
    if (cachedPersonalized) return res.json(cachedPersonalized);

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

    // 3. Fetch recent articles (last 7 days), excluding dismissed
    const dismissedForPersonalized = await db.select({ articleId: userDismissals.articleId })
      .from(userDismissals).where(eq(userDismissals.userId, userId));
    const excludeIdsForPersonalized = dismissedForPersonalized.map(r => r.articleId);
    const recent = await articleService.getRecentArticles(60, excludeIdsForPersonalized);

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

    const personalizedResult = { success: true, count: result.length, articles: result };
    await setCached(`cache:personalized:${userId}`, personalizedResult, 300);
    return res.json(personalizedResult);
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Observability metrics dashboard data
app.get('/api/metrics', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const cachedMetrics = await getCached<object>('cache:metrics');
    if (cachedMetrics) return res.json(cachedMetrics);
    const metrics = await metricsService.getDashboardMetrics();
    const metricsResponse = { success: true, metrics };
    await setCached('cache:metrics', metricsResponse, 300);
    return res.json(metricsResponse);
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
    await alertService.markOneRead(req.user.id, req.params.id as string);
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
    await alertService.deleteNotification(req.user.id, req.params.id as string);
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

    const hashtagCacheKey = `cache:hashtags:${hours}`;
    const cachedHashtags = await getCached<object>(hashtagCacheKey);
    if (cachedHashtags) return res.json(cachedHashtags);

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

    const hashtagsResponse = { success: true, trending, hours };
    await setCached(hashtagCacheKey, hashtagsResponse, 600);
    return res.json(hashtagsResponse);
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

// ── Dismiss Article ───────────────────────────────────────────────────────────

app.post('/api/articles/:id/dismiss', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const articleId = req.params.id as string;
    // Idempotent — ignore if already dismissed
    const existing = await db.select({ id: userDismissals.id })
      .from(userDismissals)
      .where(and(eq(userDismissals.userId, req.user.id), eq(userDismissals.articleId, articleId)))
      .limit(1);
    if (!existing.length) {
      await db.insert(userDismissals).values({
        id: uuidv4(),
        userId: req.user.id,
        articleId,
        createdAt: new Date().toISOString(),
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Weekly Wrap ───────────────────────────────────────────────────────────────

app.get('/api/auth/weekly-wrap', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const userId = req.user.id;

    const wrapCacheKey = `cache:weekly-wrap:${userId}`;
    const cachedWrap = await getCached<object>(wrapCacheKey);
    if (cachedWrap) return res.json(cachedWrap);

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

    // Top category from this week's reactions
    const catCounts: Record<string, number> = {};
    for (const r of reactionsThisWeek) {
      if (r.category) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
    }
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Top hashtag from this week's reactions
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
        topCategory,
        topHashtag,
        reactionsThisWeek: reactionsThisWeek.length,
        bookmarksThisWeek: Number(bookmarksThisWeek[0]?.count) || 0,
        firstName: userRow[0]?.firstName || null,
      },
    };
    await setCached(wrapCacheKey, wrapResponse, 1800); // 30 min
    return res.json(wrapResponse);
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Catch-Up Brief ───────────────────────────────────────────────────────────

app.get('/api/auth/catchup-brief', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const userId = req.user.id;

    const userRow = await db.select({ lastLoginAt: users.lastLoginAt })
      .from(users).where(eq(users.id, userId)).limit(1);

    const lastLogin = userRow[0]?.lastLoginAt;
    const now = new Date();
    const hoursSince = lastLogin
      ? (now.getTime() - new Date(lastLogin).getTime()) / 3_600_000
      : Infinity;

    // Only generate brief if user was away >24h
    if (hoursSince < 24) {
      return res.json({ success: true, shouldShow: false });
    }

    // Fetch articles published since last login (or last 48h if no prior login)
    const since = lastLogin ?? new Date(now.getTime() - 48 * 3_600_000).toISOString();
    const newArticles = await db
      .select({ id: articlesTable.id, title: articlesTable.title })
      .from(articlesTable)
      .where(gte(articlesTable.publishedAt, since))
      .orderBy(articlesTable.upvoteCount)
      .limit(50);

    const count = newArticles.length;

    // Update lastLoginAt now (before the slow Groq call)
    await db.update(users)
      .set({ lastLoginAt: now.toISOString() })
      .where(eq(users.id, userId));

    if (count === 0) {
      return res.json({ success: true, shouldShow: false });
    }

    // Summarize top 5 headlines
    const top5 = newArticles.slice(0, 5).map(a => a.title);
    const summary = await groqService.generateCatchUpBrief(top5);

    return res.json({
      success: true,
      shouldShow: true,
      count,
      summary,
      since,
      hoursAway: Math.round(hoursSince),
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── ELI5 (Explain Like I'm 5) ─────────────────────────────────────────────────

app.get('/api/articles/:id/eli5', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const row = await db
      .select({ eli5Summary: articlesTable.eli5Summary, title: articlesTable.title, content: articlesTable.content })
      .from(articlesTable)
      .where(eq(articlesTable.id, req.params.id as string))
      .limit(1);
    if (!row.length) return res.status(404).json({ success: false, error: 'Article not found' });

    if (row[0].eli5Summary) {
      return res.json({ success: true, eli5Summary: row[0].eli5Summary });
    }

    const eli5 = await groqService.generateELI5(row[0].title, row[0].content || '');
    if (eli5) {
      await articleService.updateELI5Summary(req.params.id as string, eli5);
    }
    return res.json({ success: true, eli5Summary: eli5 || null });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Developer API Key Management ─────────────────────────────────────────────

app.post('/api/developer/keys', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await db.select().from(apiKeys).where(eq(apiKeys.userId, req.user.id)).limit(1);
    if (existing.length) {
      return res.status(409).json({ success: false, error: 'API key already exists. Delete it first to create a new one.' });
    }

    const { randomUUID } = await import('crypto');
    const key = `db_${randomUUID().replace(/-/g, '')}`;
    const name = (req.body.name as string)?.trim().slice(0, 80) || 'My API Key';

    const newKey = {
      id: randomUUID(),
      userId: req.user.id,
      key,
      name,
      dailyLimit: 1000,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };

    await db.insert(apiKeys).values(newKey);
    return res.status(201).json({ success: true, apiKey: newKey });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/developer/keys', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, req.user.id));
    return res.json({ success: true, apiKeys: keys });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/developer/keys/:id', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const keyId = req.params.id as string;
    const existing = await db.select({ userId: apiKeys.userId }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    if (!existing.length) return res.status(404).json({ success: false, error: 'Key not found' });
    if (existing[0].userId !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Public API v1 (API key auth) ──────────────────────────────────────────────

app.get('/api/v1/articles', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-api-key'] as string;
    if (!key) {
      return res.status(401).json({ success: false, error: 'Missing X-API-Key header.' });
    }

    const keyRows = await db.select().from(apiKeys).where(eq(apiKeys.key, key)).limit(1);
    if (!keyRows.length) {
      return res.status(401).json({ success: false, error: 'Invalid API key.' });
    }

    const keyRecord = keyRows[0];

    // Per-key daily rate limiting via Redis
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

    // Update lastUsedAt async
    db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.key, key)).catch(() => {});

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const category = req.query.category as string | undefined;

    let articlesList;
    if (category) {
      articlesList = await articleService.getArticlesByCategory(category, limit, offset);
    } else {
      articlesList = await articleService.getArticles(limit, offset);
    }

    return res.json({
      success: true,
      count: articlesList.length,
      articles: articlesList,
      rateLimit: { limit: keyRecord.dailyLimit, used: callCount, resetsAt: `${today}T23:59:59Z` },
    });
  } catch (error: any) {
    logger.error('API v1 Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Text-to-Speech (ElevenLabs) ───────────────────────────────────────────────

app.post('/api/tts', verifyClerkToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    const audio = await ttsService.synthesize(text);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(audio.length));
    res.send(audio);
  } catch (error: any) {
    logger.error('TTS Error:', error);
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
    // Pre-load embedding model in background so first semantic search is fast
    warmupEmbedder();
  }
});