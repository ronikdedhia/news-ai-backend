import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipelineService } from '../services/pipeline.service';
import { cleanupService } from '../services/cleanup.service';

let lastCleanupDate: Date | null = null;

/**
 * Schedule news fetching and processing pipeline
 * Runs at 12:00 AM and 12:00 PM daily
 * Cleanup runs at 2:00 AM daily but only executes if 15+ days have passed since last run
 */
export function initializeNewsPipeline() {
  // 12:00 AM (00:00) - Fetch news
  const midnightJob = cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Cron triggered: Midnight news pipeline');
    await executeNewsJob();
  });

  // 12:00 PM (12:00) - Fetch news
  const noonJob = cron.schedule('0 12 * * *', async () => {
    logger.info('⏰ Cron triggered: Noon news pipeline');
    await executeNewsJob();
  });

  // 2:00 AM (02:00) - Cleanup old articles (runs daily but executes only if 15+ days passed)
  const cleanupJob = cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ Cron triggered: Cleanup check');
    await executeCleanupJob();
  });

  logger.info('✅ News pipeline cron jobs initialized');
  logger.info('📅 Schedule: News fetch at 12:00 AM and 12:00 PM daily');
  logger.info('📅 Schedule: Cleanup check at 2:00 AM daily (executes if 15+ days since last run)');

  return { midnightJob, noonJob, cleanupJob };
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
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ News pipeline job failed: ${error.message}`);
  }
}

/**
 * Execute cleanup with smart 15-day interval check
 */
async function executeCleanupJob() {
  try {
    const now = new Date();

    // Check if cleanup should run (first time or 15+ days since last run)
    if (lastCleanupDate === null) {
      // First run - check if there's a stored last cleanup date in env or use current
      const envLastCleanup = process.env.LAST_CLEANUP_DATE;
      if (envLastCleanup) {
        lastCleanupDate = new Date(envLastCleanup);
      } else {
        lastCleanupDate = now;
        logger.info('📅 First cleanup run - initializing cleanup schedule');
        return;
      }
    }

    const daysSinceLastCleanup = Math.floor(
      (now.getTime() - lastCleanupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastCleanup >= 15) {
      logger.info(`🗑️ Cleanup job started (${daysSinceLastCleanup} days since last run)`);

      const result = await cleanupService.deleteOldArticles(30);

      lastCleanupDate = now;
      process.env.LAST_CLEANUP_DATE = now.toISOString();

      logger.info(`✅ Cleanup job completed: ${result.deleted} articles deleted`);
    } else {
      logger.debug(
        `⏭️ Cleanup skipped: Only ${daysSinceLastCleanup} days since last run (need 15 days)`
      );
    }
  } catch (error: any) {
    logger.error(`❌ Cleanup job failed: ${error.message}`);
  }
}

/**
 * Manual trigger for testing (optional)
 */
export async function triggerNewsPipelineManually() {
  logger.info('🔄 Manual trigger: News pipeline');
  await executeNewsJob();
}
