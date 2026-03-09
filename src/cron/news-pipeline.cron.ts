import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipelineService } from '../services/pipeline.service';
import { cleanupService } from '../services/cleanup.service';

let lastCleanupDateNewsData: Date | null = null;
let lastCleanupDateAlphaVantage: Date | null = null;

/**
 * Schedule news fetching and processing pipeline
 * NewsData: 12:00 AM and 12:00 PM, Cleanup at 2:00 AM
 * Alpha Vantage: 8:30 AM, 10:30 AM, 12:30 PM, 2:30 PM, 4:30 PM, 6:30 PM, 8:30 PM, Cleanup at 1:00 AM
 */
export function initializeNewsPipeline() {
  // ===== NewsData Pipeline =====
  // 12:00 AM (00:00) - NewsData
  const newsDataMidnight = cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:00 AM NewsData pipeline');
    await executeNewsDataJob();
  });

  // 12:00 PM (12:00) - NewsData
  const newsDataNoon = cron.schedule('0 12 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:00 PM NewsData pipeline');
    await executeNewsDataJob();
  });

  // ===== Alpha Vantage Pipeline =====
  // 8:30 AM
  const alphaVantage830am = cron.schedule('30 8 * * *', async () => {
    logger.info('⏰ Cron triggered: 8:30 AM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 10:30 AM
  const alphaVantage1030am = cron.schedule('52 10 * * *', async () => {
    logger.info('⏰ Cron triggered: 10:30 AM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 12:30 PM
  const alphaVantage1230pm = cron.schedule('30 12 * * *', async () => {
    logger.info('⏰ Cron triggered: 12:30 PM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 2:30 PM
  const alphaVantage230pm = cron.schedule('30 14 * * *', async () => {
    logger.info('⏰ Cron triggered: 2:30 PM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 4:30 PM
  const alphaVantage430pm = cron.schedule('30 16 * * *', async () => {
    logger.info('⏰ Cron triggered: 4:30 PM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 6:30 PM
  const alphaVantage630pm = cron.schedule('30 18 * * *', async () => {
    logger.info('⏰ Cron triggered: 6:30 PM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // 8:30 PM
  const alphaVantage830pm = cron.schedule('30 20 * * *', async () => {
    logger.info('⏰ Cron triggered: 8:30 PM Alpha Vantage pipeline');
    await executeAlphaVantageJob();
  });

  // ===== Cleanup Jobs =====
  // 2:00 AM - NewsData Cleanup (runs daily but executes only if 15+ days passed)
  const newsDataCleanup = cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ Cron triggered: NewsData Cleanup check');
    await executeNewsDataCleanupJob();
  });

  // 1:00 AM - Alpha Vantage Cleanup (runs daily but executes only if 15+ days passed)
  const alphaVantageCleanup = cron.schedule('0 1 * * *', async () => {
    logger.info('⏰ Cron triggered: Alpha Vantage Cleanup check');
    await executeAlphaVantageCleanupJob();
  });

  logger.info('✅ News pipeline cron jobs initialized');
  logger.info('📅 NewsData: 12:00 AM and 12:00 PM daily, Cleanup at 2:00 AM');
  logger.info('📅 Alpha Vantage: 8:30 AM, 10:30 AM, 12:30 PM, 2:30 PM, 4:30 PM, 6:30 PM, 8:30 PM daily, Cleanup at 1:00 AM');

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
  const jobStartTime = new Date().toISOString();

  try {
    logger.info(`🔄 NewsData pipeline job started at ${jobStartTime}`);

    const result = await pipelineService.executeNewsDataPipeline();

    logger.info(`✅ NewsData pipeline job completed`);
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ NewsData pipeline job failed: ${error.message}`);
  }
}

/**
 * Execute Alpha Vantage pipeline
 */
async function executeAlphaVantageJob() {
  const jobStartTime = new Date().toISOString();

  try {
    logger.info(`🔄 Alpha Vantage pipeline job started at ${jobStartTime}`);

    const result = await pipelineService.executeAlphaVantagePipeline();

    logger.info(`✅ Alpha Vantage pipeline job completed`);
    logger.info(`📈 Results: ${result.processed} processed, ${result.saved} saved, ${result.telegramSent} Telegram sent, ${result.errors} errors`);
  } catch (error: any) {
    logger.error(`❌ Alpha Vantage pipeline job failed: ${error.message}`);
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
