import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config'
import { logger } from './utils/logger';
import { newsFetcherAgent } from './agents/news-fetcher.agent';
import { summarizationAgent } from './agents/summarization.agent';
import { initializeNewsPipeline, triggerNewsPipelineManually } from './cron/news-pipeline.cron';
import { articleService } from './services/article.service';
import { userService } from './services/user.service';
import { initializeDatabase } from './db/client';
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

// Test endpoint: Fetch news only
app.post('/api/test/fetch-news', async (req: Request, res: Response) => {
  try {
    logger.info('📡 API: Fetching news articles...');

    const result = await newsFetcherAgent.execute();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      count: result.count,
      articles: result.articles,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint: Summarize text
app.post('/api/test/summarize', async (req: Request, res: Response) => {
  try {
    const { text, language = 'english' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required in request body',
      });
    }

    logger.info(`📡 API: Generating summary in ${language}...`);

    const { groqService } = await import('./services/groq.service');
    const summary = await groqService.summarizeText(text, language);

    res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint: Generate hashtags
app.post('/api/test/generate-hashtags', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required in request body',
      });
    }

    logger.info(`📡 API: Generating hashtags...`);

    const { hashtagService } = await import('./services/hashtag.service');
    const hashtags = await hashtagService.generateHashtags(text);

    res.json({
      success: true,
      hashtags,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main endpoint: Fetch + Summarize
app.post('/api/fetch-and-summarize', async (req: Request, res: Response) => {
  try {
    logger.info('📡 API: Starting fetch and summarize pipeline...');

    // Step 1: Fetch news
    const fetchResult = await newsFetcherAgent.execute();

    if (!fetchResult.success) {
      return res.status(500).json({
        success: false,
        error: fetchResult.error,
      });
    }

    // Step 2: Summarize articles
    const summarizeResult = await summarizationAgent.execute(fetchResult.articles);

    res.json({
      success: true,
      articlesFetched: fetchResult.count,
      articlesSummarized: summarizeResult.articlesProcessed,
      summaries: summarizeResult.summaries,
      errors: summarizeResult.errors,
    });
  } catch (error: any) {
    logger.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint: Trigger news pipeline manually
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

// Endpoint: Get all articles (with free tier limit)
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

      // Track article views
      await userService.incrementArticlesViewed(req.user.id);

      return res.json({
        success: true,
        count: articles.length,
        articles,
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
    return res.json({
      success: true,
      count: articles.length,
      articles,
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

// Endpoint: Update bookmark count (increment/decrement)
app.post('/api/articles/:id/bookmark', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { action } = req.body as { action: string };

    if (!action || !['increment', 'decrement'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "increment" or "decrement"',
      });
    }

    const result = await articleService.updateBookmarkCount(id, action as 'increment' | 'decrement');

    res.json({
      success: true,
      articleId: id,
      bookmarkCount: result.bookmarkCount,
      action,
    });
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

// Endpoint: Get trending articles (sorted by bookmarks)
app.get('/api/articles/trending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const trendingArticles = await articleService.getTrendingArticles(limit, offset);

    res.json({
      success: true,
      count: trendingArticles.length,
      articles: trendingArticles,
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
  }
});