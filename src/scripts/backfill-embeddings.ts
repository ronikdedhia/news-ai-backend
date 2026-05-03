import 'dotenv/config';
import { rawClient } from '../db/client';
import { embedText } from '../services/embedding.service';
import { logger } from '../utils/logger';

const BATCH_SIZE = 10;

async function backfill() {
  logger.info('🔍 Fetching articles without embeddings...');

  const result = await rawClient.execute(
    `SELECT id, title, content FROM articles WHERE embedding IS NULL ORDER BY published_at DESC`
  );

  const rows = result.rows as unknown as Array<{ id: string; title: string; content: string | null }>;
  logger.info(`Found ${rows.length} articles to embed`);

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const text = `${row.title} ${row.content || ''}`;
          const embedding = await embedText(text);
          const vectorJson = `[${embedding.join(',')}]`;
          await rawClient.execute({
            sql: `UPDATE articles SET embedding = vector(?) WHERE id = ?`,
            args: [vectorJson, row.id],
          });
          done++;
        } catch (err: any) {
          logger.warn(`Failed to embed article ${row.id}: ${err.message}`);
        }
      })
    );
    logger.info(`Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  logger.info(`✅ Backfill complete. Embedded ${done}/${rows.length} articles.`);
  process.exit(0);
}

backfill().catch((err) => {
  logger.error('Backfill failed:', err.message);
  process.exit(1);
});
