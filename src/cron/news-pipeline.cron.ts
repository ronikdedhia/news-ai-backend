import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipelineService } from '../services/pipeline.service';
import { cleanupService } from '../services/cleanup.service';
import { alertService } from '../services/alert.service';
import { metricsService } from '../services/metrics.service';

let lastCleanupDateNewsData: Date | null = null;
let lastCleanupDateAlphaVantage: Date | null = null;

/**
 * Schedule news fetching and processing pipeline
 * NewsData: 12:00 AM and 12:00 PM, Cleanup at 2:00 AM
 * Alpha Vantage: 8:30 AM, 10:30 AM, 12:30 PM, 2:30 PM, 4:30 PM, 6:30 PM, 8:30 PM, Cleanup at 1:00 AM
 */
export function initializeNewsPipeline() {
  // ===== NewsData Pipeline =====
  // 12:00 AM IST = 18:30 UTC
  const newsDataMidnight = cron.schedule('30 18 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:00 AM IST NewsData pipeline');
    await executeNewsDataJob();
  });

  // 12:00 PM IST = 06:30 UTC
  const newsDataNoon = cron.schedule('30 6 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:00 PM IST NewsData pipeline');
    await executeNewsDataJob();
  });

  // ===== Alpha Vantage Pipeline =====
  // 8:30 AM IST = 03:00 UTC
  const alphaVantage830am = cron.schedule('0 3 * * *', async () => {
    logger.info('⏰ Cron triggered: 8:30 AM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 10:30 AM IST = 05:00 UTC
  const alphaVantage1030am = cron.schedule('0 5 * * *', async () => {
    logger.info('⏰ Cron triggered: 10:30 AM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 12:30 PM IST = 07:00 UTC
  const alphaVantage1230pm = cron.schedule('0 7 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:30 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 2:30 PM IST = 09:00 UTC
  const alphaVantage230pm = cron.schedule('0 9 * * *', async () => {
    logger.info('⏰ Cron triggered: 2:30 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 4:30 PM IST = 11:00 UTC
  const alphaVantage430pm = cron.schedule('0 11 * * *', async () => {
    logger.info('⏰ Cron triggered: 4:30 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 6:30 PM IST = 13:00 UTC
  const alphaVantage630pm = cron.schedule('0 13 * * *', async () => {
    logger.info('⏰ Cron triggered: 6:30 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 8:30 PM IST = 15:00 UTC
  const alphaVantage830pm = cron.schedule('0 15 * * *', async () => {
    logger.info('⏰ Cron triggered: 8:30 PM IST Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // ===== Cleanup Jobs =====
  // 2:00 AM IST = 20:30 UTC
  const newsDataCleanup = cron.schedule('30 20 * * *', async () => {
    logger.info('⏰ Cron triggered: NewsData Cleanup check');
    await executeNewsDataCleanupJob();
  });

  // 1:00 AM IST = 19:30 UTC
  const alphaVantageCleanup = cron.schedule('30 19 * * *', async () => {
    logger.info('⏰ Cron triggered: Alpha Vantage Cleanup check');
    await executeAlphaVantageCleanupJob();
  });

  logger.info('✅ News pipeline cron jobs initialized (all times UTC, converted from IST)');
  logger.info('📅 NewsData: 18:30 UTC and 06:30 UTC daily, Cleanup at 20:30 UTC');
  logger.info('📅 Alpha Vantage: 03:00, 05:00, 07:00, 09:00, 11:00, 13:00, 15:00 UTC daily, Cleanup at 19:30 UTC');

  return {
    newsDataMidnight,
    newsDataNoon,
    alphaVantage830am,
    alphaVantage1030am,
    alphaVantage1230pm,
    alphaVantage230pm,
    alphaVantage430pm,
    alphaVantage630pm,
    alphaVantage830pm,
    newsDataCleanup,
    alphaVantageCleanup,
  };
}

/**
 * Execute NewsData pipeline
 */
async function executeNewsDataJob() {
  const startTs = Date.now();
  const runId = await metricsService.recordRunStart('newsdata').catch(() => '');

  try {
    logger.info('🔄 NewsData pipeline job started');

    const result = await pipelineService.executeNewsDataPipeline();

    logger.info(`✅ NewsData pipeline job completed`);
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);

    if (runId) await metricsService.recordRunComplete(runId, result, startTs).catch(() => {});
    await alertService.checkRecentArticles();
  } catch (error: any) {
    logger.error(`❌ NewsData pipeline job failed: ${error.message}`);
    if (runId) await metricsService.recordRunFailed(runId, startTs).catch(() => {});
  }
}

/**
 * Execute Alpha Vantage pipeline
 */
async function executeAlphaVantageJob() {
  const startTs = Date.now();
  const runId = await metricsService.recordRunStart('alpha_vantage').catch(() => '');

  try {
    logger.info('🔄 Alpha Vantage pipeline job started');

    const result = await pipelineService.executeAlphaVantagePipeline();

    logger.info(`✅ Alpha Vantage pipeline job completed`);
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);

    if (runId) await metricsService.recordRunComplete(runId, result, startTs).catch(() => {});
  } catch (error: any) {
    logger.error(`❌ Alpha Vantage pipeline job failed: ${error.message}`);
    if (runId) await metricsService.recordRunFailed(runId, startTs).catch(() => {});
  }
}

/**
 * Execute NewsData cleanup with smart 15-day interval check
 */
async function executeNewsDataCleanupJob() {
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
async function executeAlphaVantageCleanupJob() {
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
  logger.info('� Manual trigger: News pipeline');
  await executeNewsDataJob();
}
