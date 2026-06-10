import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { logger } from '../utils/logger';
import { triggerNewsPipelineManually } from '../cron/news-pipeline.cron';
import { triggerNewsletterManually } from '../cron/newsletter.cron';
import { deleteCached } from '../lib/redis';

const router = Router();

router.post('/trigger-pipeline', asyncHandler(async (req, res) => {
  const secret = req.headers['x-pipeline-secret'] || req.body?.secret;
  if (!process.env.PIPELINE_SECRET || secret !== process.env.PIPELINE_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  logger.info('📡 API: Manual pipeline trigger');
  await triggerNewsPipelineManually();
  await deleteCached(
    'cache:articles:free',
    'cache:trending',
    'cache:hashtags',
    'cache:trending:articles:10:0',
    'cache:metrics',
  );
  return res.json({ success: true, message: 'Pipeline triggered successfully' });
}));

router.post('/trigger-newsletter', asyncHandler(async (req, res) => {
  const secret = req.headers['x-pipeline-secret'] || req.body?.secret;
  if (!process.env.PIPELINE_SECRET || secret !== process.env.PIPELINE_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  logger.info('📡 API: Manual newsletter trigger');
  await triggerNewsletterManually();
  return res.json({ success: true, message: 'Newsletter triggered successfully' });
}));

export default router;
