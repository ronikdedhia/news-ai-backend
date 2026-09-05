import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { qstashVerify } from '../middleware/qstash.middleware';
import {
  executeNewsDataJob,
  executeAlphaVantageJob,
  executeNewsDataCleanupJob,
  executeAlphaVantageCleanupJob,
} from '../cron/news-pipeline.cron';
import { triggerNewsletterManually } from '../cron/newsletter.cron';

const router = Router();

router.post('/qstash/news-data', qstashVerify, asyncHandler(async (_req, res) => {
  await executeNewsDataJob();
  res.json({ status: 'ok' });
}));

router.post('/qstash/alpha-vantage', qstashVerify, asyncHandler(async (_req, res) => {
  await executeAlphaVantageJob();
  res.json({ status: 'ok' });
}));

router.post('/qstash/cleanup-newsdata', qstashVerify, asyncHandler(async (_req, res) => {
  await executeNewsDataCleanupJob();
  res.json({ status: 'ok' });
}));

router.post('/qstash/cleanup-alphavantage', qstashVerify, asyncHandler(async (_req, res) => {
  await executeAlphaVantageCleanupJob();
  res.json({ status: 'ok' });
}));

router.post('/qstash/newsletter', qstashVerify, asyncHandler(async (_req, res) => {
  await triggerNewsletterManually();
  res.json({ status: 'ok' });
}));

export default router;
