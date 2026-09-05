import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipelineService } from '../services/pipeline.service';
import { cleanupService } from '../services/cleanup.service';

let lastCleanupDateNewsData: Date | null = null;
let lastCleanupDateAlphaVantage: Date | null = null;

/**
 * Schedule news fetching and processing pipeline
 * NewsData: 2:00 PM IST, Alpha Vantage: 1:00 PM IST, Cleanup at 6:00 PM IST
 */
export function initializeNewsPipeline() {
  // ===== NewsData Pipeline =====
  // 2:00 PM IST = 08:30 UTC
  const newsData = cron.schedule('30 8 * * *', async () => {
    logger.info('⏰ Cron triggered: 2:00 PM IST NewsData pipeline');
    await executeNewsDataJob();
  });

  // ===== Alpha Vantage Pipeline =====
  // 1:00 PM IST = 07:30 UTC
  const alphaVantage = cron.schedule('30 7 * * *', async () => {
    logger.info('⏰ Cron triggered: 1:00 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // ===== Cleanup Jobs =====
  // 6:00 PM IST = 12:30 UTC
  const newsDataCleanup = cron.schedule('30 12 * * *', async () => {
    logger.info('⏰ Cron triggered: NewsData Cleanup check');
    await executeNewsDataCleanupJob();
  });

  // 6:00 PM IST = 12:30 UTC
  const alphaVantageCleanup = cron.schedule('30 12 * * *', async () => {
    logger.info('⏰ Cron triggered: Alpha Vantage Cleanup check');
    await executeAlphaVantageCleanupJob();
  });

  logger.info('✅ News pipeline cron jobs initialized');
  logger.info('📅 NewsData: 2:00 PM IST daily');
  logger.info('📅 Alpha Vantage: 1:00 PM IST daily');
  logger.info('📅 Cleanup: 6:00 PM IST daily');

  return {
    newsData,
    alphaVantage,
    newsDataCleanup,
    alphaVantageCleanup,
  };
}

/**
 * Execute NewsData pipeline
 */
export async function executeNewsDataJob() {
  try {
    logger.info('🔄 NewsData pipeline job started');
    const result = await pipelineService.executeNewsDataPipeline();
    logger.info(`✅ NewsData done: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ NewsData pipeline job failed: ${error.message}`);
  }
}

/**
 * Execute Alpha Vantage pipeline
 */
export async function executeAlphaVantageJob() {
  try {
    logger.info('🔄 Alpha Vantage pipeline job started');
    const result = await pipelineService.executeAlphaVantagePipeline();
    logger.info(`✅ Alpha Vantage done: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ Alpha Vantage pipeline job failed: ${error.message}`);
  }
}

/**
 * Execute NewsData cleanup with smart 15-day interval check
 */
export async function executeNewsDataCleanupJob() {
  try {
    const now = new Date();

    if (lastCleanupDateNewsData === null) {
      const envLastCleanup = process.env.LAST_CLEANUP_DATE_NEWSDATA;
      if (envLastCleanup) {
        lastCleanupDateNewsData = new Date(envLastCleanup);
      } else {
        lastCleanupDateNewsData = now;
        logger.info('📅 First cleanup run for NewsData - initializing cleanup schedule');
        return;
      }
    }

    const daysSinceLastCleanup = Math.floor(
      (now.getTime() - lastCleanupDateNewsData.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastCleanup >= 15) {
      logger.info(`�️ NewsData cleanup job started (${daysSinceLastCleanup} days since last run)`);

      const result = await cleanupService.deleteOldArticles(30);

      lastCleanupDateNewsData = now;
      process.env.LAST_CLEANUP_DATE_NEWSDATA = now.toISOString();

      logger.info(`✅ NewsData cleanup job completed: ${result.deleted} articles deleted`);
    } else {
      logger.debug(
        `⏭️ NewsData cleanup skipped: Only ${daysSinceLastCleanup} days since last run (need 15 days)`
      );
    }
  } catch (error: any) {
    logger.error(`❌ NewsData cleanup job failed: ${error.message}`);
  }
}

/**
 * Execute Alpha Vantage cleanup with smart 15-day interval check
 */
export async function executeAlphaVantageCleanupJob() {
  try {
    const now = new Date();

    if (lastCleanupDateAlphaVantage === null) {
      const envLastCleanup = process.env.LAST_CLEANUP_DATE_ALPHAVANTAGE;
      if (envLastCleanup) {
        lastCleanupDateAlphaVantage = new Date(envLastCleanup);
      } else {
        lastCleanupDateAlphaVantage = now;
        logger.info('� First cleanup run for Alpha Vantage - initializing cleanup schedule');
        return;
      }
    }

    const daysSinceLastCleanup = Math.floor(
      (now.getTime() - lastCleanupDateAlphaVantage.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastCleanup >= 15) {
      logger.info(`�️ Alpha Vantage cleanup job started (${daysSinceLastCleanup} days since last run)`);

      const result = await cleanupService.deleteOldArticles(30);

      lastCleanupDateAlphaVantage = now;
      process.env.LAST_CLEANUP_DATE_ALPHAVANTAGE = now.toISOString();

      logger.info(`✅ Alpha Vantage cleanup job completed: ${result.deleted} articles deleted`);
    } else {
      logger.debug(
        `⏭️ Alpha Vantage cleanup skipped: Only ${daysSinceLastCleanup} days since last run (need 15 days)`
      );
    }
  } catch (error: any) {
    logger.error(`❌ Alpha Vantage cleanup job failed: ${error.message}`);
  }
}

/**
 * Manual trigger for testing (optional)
 */
export async function triggerNewsPipelineManually() {
  logger.info('🔄 Manual trigger: News pipeline');
  try {
    const result = await pipelineService.executeNewsDataPipeline({ fresh: true });
    logger.info(`✅ Manual trigger done: ${result.processed} processed, ${result.saved} saved, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ Manual trigger failed: ${error.message}`);
  }
}
