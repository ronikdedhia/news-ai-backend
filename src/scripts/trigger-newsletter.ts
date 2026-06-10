import 'dotenv/config';
import { triggerNewsletterManually } from '../cron/newsletter.cron';
import { logger } from '../utils/logger';

logger.info('📧 Manual newsletter trigger started...');
triggerNewsletterManually()
  .then(() => {
    logger.info('✅ Newsletter trigger complete');
    process.exit(0);
  })
  .catch(err => {
    logger.error('❌ Newsletter failed:', err.message);
    process.exit(1);
  });
