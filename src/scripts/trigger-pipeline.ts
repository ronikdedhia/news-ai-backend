import 'dotenv/config';
import { runNewsPipeline } from '../agents/pipeline/graph';
import { logger } from '../utils/logger';

logger.info('🔄 Manual pipeline trigger started...');
runNewsPipeline('newsdata', { fresh: true })
  .then(result => {
    logger.info('✅ Pipeline complete:', result);
    process.exit(0);
  })
  .catch(err => {
    logger.error('❌ Pipeline failed:', err.message);
    process.exit(1);
  });
