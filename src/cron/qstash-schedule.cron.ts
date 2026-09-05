import { Client } from '@upstash/qstash';
import { logger } from '../utils/logger';
import { getNewsletterCronExpression } from './newsletter.cron';

async function registerSchedule(qstash: Client, destination: string, cron: string, label: string) {
  const existing = await qstash.schedules.list();
  if (existing.some((s: { destination: string }) => s.destination === destination)) return;
  await qstash.schedules.create({ destination, cron });
  logger.info(`✅ [qstash] schedule registered → ${label} (${destination})`);
}

/**
 * Registers external QStash schedules that hit this service over HTTP —
 * unlike node-cron, these fire even if the process was asleep/restarted,
 * as long as QSTASH_TOKEN + BACKEND_PUBLIC_URL are set.
 */
export async function initializeQStashSchedules() {
  const token = process.env.QSTASH_TOKEN;
  const backendUrl = process.env.BACKEND_PUBLIC_URL;
  if (!token || !backendUrl) {
    logger.info('[qstash] QSTASH_TOKEN or BACKEND_PUBLIC_URL not set — relying on node-cron only');
    return;
  }

  const qstash = new Client({ token });

  try {
    await registerSchedule(qstash, `${backendUrl}/api/qstash/alpha-vantage`,        '30 7 * * *',  'Alpha Vantage pipeline — 1:00 PM IST daily');
    await registerSchedule(qstash, `${backendUrl}/api/qstash/news-data`,            '30 8 * * *',  'NewsData pipeline — 2:00 PM IST daily');
    await registerSchedule(qstash, `${backendUrl}/api/qstash/cleanup-newsdata`,     '30 12 * * *', 'NewsData cleanup check — 6:00 PM IST daily');
    await registerSchedule(qstash, `${backendUrl}/api/qstash/cleanup-alphavantage`, '30 12 * * *', 'Alpha Vantage cleanup check — 6:00 PM IST daily');

    const sendTime = process.env.NEWSLETTER_SEND_TIME || '06:30';
    const newsletterCron = getNewsletterCronExpression(sendTime);
    await registerSchedule(qstash, `${backendUrl}/api/qstash/newsletter`, newsletterCron, `Newsletter — ${sendTime} UTC daily`);
  } catch (error: any) {
    logger.error(`❌ [qstash] schedule registration failed: ${error.message}`);
  }
}
