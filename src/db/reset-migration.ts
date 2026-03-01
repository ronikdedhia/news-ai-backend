import 'dotenv/config';
import { createClient } from '@libsql/client';
import { logger } from '../utils/logger';

const connectionString = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!connectionString || !authToken) {
  logger.error('DATABASE_URL and DATABASE_AUTH_TOKEN are required');
  process.exit(1);
}

const client = createClient({
  url: connectionString,
  authToken: authToken,
});

async function resetMigrations() {
  try {
    logger.info('🔄 Resetting database...');

    // Drop existing tables
    try {
      await client.execute('DROP TABLE IF EXISTS user_bookmarks');
      logger.info('✅ Dropped user_bookmarks table');
    } catch (e) {
      logger.warn('Could not drop user_bookmarks');
    }

    try {
      await client.execute('DROP TABLE IF EXISTS users');
      logger.info('✅ Dropped users table');
    } catch (e) {
      logger.warn('Could not drop users');
    }

    // Create users table
    await client.execute(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        is_premium INTEGER NOT NULL DEFAULT 0,
        articles_viewed_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Created users table');

    // Create user_bookmarks table
    await client.execute(`
      CREATE TABLE user_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    logger.info('✅ Created user_bookmarks table');

    // Create indexes
    await client.execute(`
      CREATE INDEX idx_users_email ON users(email)
    `);
    logger.info('✅ Created index on users.email');

    await client.execute(`
      CREATE INDEX idx_user_bookmarks_user_id ON user_bookmarks(user_id)
    `);
    logger.info('✅ Created index on user_bookmarks.user_id');

    await client.execute(`
      CREATE INDEX idx_user_bookmarks_article_id ON user_bookmarks(article_id)
    `);
    logger.info('✅ Created index on user_bookmarks.article_id');

    logger.info('✅ Database reset completed successfully!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

resetMigrations();
