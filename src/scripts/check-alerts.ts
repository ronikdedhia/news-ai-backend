import 'dotenv/config';
import { db } from '../db/client';
import { articles } from '../db/schema';
import { desc } from 'drizzle-orm';
import { alertService } from '../services/alert.service';
import { logger } from '../utils/logger';

async function main() {
  const recent = await db
    .select({ id: articles.id, title: articles.title, url: articles.url })
    .from(articles)
    .orderBy(desc(articles.publishedAt))
    .limit(20);

  logger.info(`Checking ${recent.length} recent articles against all user alerts...`);
  await alertService.checkNewArticles(recent);
  logger.info('Done. Check /notifications in the app.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
