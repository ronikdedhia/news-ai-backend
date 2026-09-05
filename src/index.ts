import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { initializeNewsPipeline } from './cron/news-pipeline.cron';
import { initializeNewsletterCron } from './cron/newsletter.cron';
import { initializeQStashSchedules } from './cron/qstash-schedule.cron';
import { initializeDatabase } from './db/client';
import { warmupEmbedder } from './services/embedding.service';
import articlesRouter from './routes/articles.router';
import authRouter from './routes/auth.router';
import bookmarksRouter from './routes/bookmarks.router';
import notificationsRouter from './routes/notifications.router';
import pipelineRouter from './routes/pipeline.router';
import qstashRouter from './routes/qstash.router';
import developerRouter from './routes/developer.router';
import miscRouter from './routes/misc.router';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json({
  verify: (req: any, _res, buf: Buffer) => { req.rawBody = buf.toString(); },
}));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many search requests. Please wait a moment.',
});
app.use('/api/search', searchLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), environment: config.server.nodeEnv });
});

app.use('/api/articles', articlesRouter);
app.use('/api/auth', authRouter);
app.use('/api', bookmarksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', pipelineRouter);
app.use('/api', qstashRouter);
app.use('/api', developerRouter);
app.use('/api', miscRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err.message);
  res.status(err.status ?? err.statusCode ?? 500).json({
    success: false,
    error: err.message ?? 'Internal server error',
  });
});

const PORT = config.server.port;

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.nodeEnv}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);

  const dbConnected = await initializeDatabase();

  if (!dbConnected) {
    logger.warn('⚠️  Database connection failed at boot. Cron jobs are still being scheduled —');
    logger.warn('💡 each run will retry its own DB connection rather than never firing again.');
  } else {
    warmupEmbedder();
  }

  // Scheduled regardless of the boot-time DB check above: a transient connection
  // blip at startup used to permanently disable every cron for the process's
  // lifetime. Each job now attempts its own DB work per run and just logs/retries
  // on failure instead of silently never running again until the next restart.
  initializeNewsPipeline();
  initializeNewsletterCron();
  await initializeQStashSchedules();
});
