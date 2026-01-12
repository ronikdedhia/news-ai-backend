import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipelineService } from '../services/pipeline.service';

/**
 * Schedule news fetching and processing pipeline
 * Runs at 12:00 AM and 12:00 PM daily
 */
export function initializeNewsPipeline() {
  // 12:00 AM (00:00)
  const midnightJob = cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Cron triggered: Midnight news pipeline');
    await executeNewsJob();
  });

  // 12:00 PM (12:00)
  const noonJob = cron.schedule('0 12 * * *', async () => {
    logger.info('⏰ Cron triggered: Noon news pipeline');
    await executeNewsJob();
  });

  logger.info('✅ News pipeline cron jobs initialized');
  logger.info('📅 Schedule: Daily at 12:00 AM and 12:00 PM');

  return { midnightJob, noonJob };
}

/**
 * Execute the news pipeline with error handling
 */
async function executeNewsJob() {
  const jobStartTime = new Date().toISOString();

  try {
    logger.info(`🔄 News pipeline job started at ${jobStartTime}`);

    const result = await pipelineService.executePipeline();

    logger.info(`✅ News pipeline job completed`);
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ News pipeline job failed: ${error.message}`);
  }
}

/**
 * Manual trigger for testing (optional)
 */
export async function triggerNewsPipelineManually() {
  logger.info('🔄 Manual trigger: News pipeline');
  await executeNewsJob();
}
