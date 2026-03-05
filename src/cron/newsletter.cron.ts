import cron from 'node-cron';
import { logger } from '../utils/logger';
import { newsletterService } from '../services/newsletter.service';

/**
 * Parse time string in HH:MM format (e.g., "08:00")
 * Returns cron expression for that time daily
 */
function getNewsletterCronExpression(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    logger.warn(`Invalid time format: ${timeString}, using default 08:00`);
    return '0 8 * * *'; // Default to 8 AM
  }
  return `${minutes} ${hours} * * *`;
}

/**
 * Initialize newsletter cron job
 * Sends daily newsletter at configured time (default: 8:00 AM)
 */
export function initializeNewsletterCron() {
  const sendTime = process.env.NEWSLETTER_SEND_TIME || '08:00';
  const cronExpression = getNewsletterCronExpression(sendTime);

  const newsletterJob = cron.schedule(cronExpression, async () => {
    logger.info(`⏰ Cron triggered: Daily newsletter at ${sendTime}`);
    await executeNewsletterJob();
  });

  logger.info('✅ Newsletter cron job initialized');
  logger.info(`📅 Schedule: Daily newsletter at ${sendTime}`);

  return { newsletterJob };
}

/**
 * Execute newsletter send with error handling
 */
async function executeNewsletterJob() {
  const jobStartTime = new Date().toISOString();

  try {
    logger.info(`🔄 Newsletter job started at ${jobStartTime}`);

    const result = await newsletterService.sendNewsletterToAll();

    logger.info(`✅ Newsletter job completed`);
    logger.info(`📈 Results: ${result.sent} sent, ${result.failed} failed`);
  } catch (error: any) {
    logger.error(`❌ Newsletter job failed: ${error.message}`);
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerNewsletterManually() {
  logger.info('🔄 Manual trigger: Newsletter');
  await executeNewsletterJob();
}
