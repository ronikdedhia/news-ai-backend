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
    return '0 8 * * *';
  }
  return `${minutes} ${hours} * * *`;
}

function utcToIST(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const totalMins = (h * 60 + m + 330) % (24 * 60);
  const istH = Math.floor(totalMins / 60);
  const istM = totalMins % 60;
  const period = istH >= 12 ? 'PM' : 'AM';
  const h12 = istH === 0 ? 12 : istH > 12 ? istH - 12 : istH;
  return `${h12}:${istM.toString().padStart(2, '0')} ${period} IST`;
}

/**
 * Initialize newsletter cron job
 * Sends daily newsletter at configured time (default: 8:00 AM)
 */
export function initializeNewsletterCron() {
  const sendTime = process.env.NEWSLETTER_SEND_TIME || '06:30'; // 12:00 PM IST = 06:30 UTC
  const cronExpression = getNewsletterCronExpression(sendTime);

  const newsletterJob = cron.schedule(cronExpression, async () => {
    logger.info(`⏰ Cron triggered: Daily newsletter (${utcToIST(sendTime)})`);
    await executeNewsletterJob();
  });

  logger.info('✅ Newsletter cron job initialized');
  logger.info(`📅 Newsletter: ${utcToIST(sendTime)} daily`);

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
