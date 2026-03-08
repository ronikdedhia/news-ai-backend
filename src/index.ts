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
import { initializeDatabase } from './db/client';
import { db } from './db/client';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import { verifyClerkToken, optionalAuth } from './middleware/auth.middleware';

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

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
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

      // Get bookmark status for all articles in one query
      const articleIds = articles.map(a => a.id);
      const bookmarkStatus = await bookmarkService.checkMultipleBookmarks(req.user.id, articleIds);

      // Attach bookmark status to articles
      const articlesWithBookmarks = articles.map(article => ({
        ...article,
        isBookmarked: bookmarkStatus[article.id] || false,
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

    // Get bookmark status if user is authenticated
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

    const bookmarks = await bookmarkService.getUserBookmarks(req.user.id, limit, offset);

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