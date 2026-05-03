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

async function runMigrations() {
  try {
    logger.info('🔄 Starting database migrations...');

    // Create users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        is_premium BOOLEAN NOT NULL DEFAULT 0,
        articles_viewed_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Created users table');

    // Create articles table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        hashtags TEXT,
        url TEXT NOT NULL UNIQUE,
        image_url TEXT,
        published_at TEXT NOT NULL,
        bookmark_count INTEGER NOT NULL DEFAULT 0,
        category TEXT
      )
    `);
    logger.info('✅ Created articles table');

    // Add category column if it doesn't exist (for existing databases)
    try {
      await client.execute(`
        ALTER TABLE articles ADD COLUMN category TEXT
      `);
      logger.info('✅ Added category column to articles table');
    } catch (error: any) {
      if (error.message.includes('duplicate column')) {
        logger.info('ℹ️  Category column already exists');
      } else {
        throw error;
      }
    }

    // Ensure bookmark_count has no NULL values
    try {
      await client.execute(`
        UPDATE articles SET bookmark_count = 0 WHERE bookmark_count IS NULL
      `);
      logger.info('✅ Fixed NULL bookmark_count values');
    } catch (error: any) {
      logger.warn('ℹ️  Could not update NULL bookmark_count values:', error.message);
    }

    // Create user_bookmarks table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, article_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )
    `);
    logger.info('✅ Created user_bookmarks table');

    // Create indexes for better query performance
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    logger.info('✅ Created index on users.email');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url)
    `);
    logger.info('✅ Created index on articles.url');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at)
    `);
    logger.info('✅ Created index on articles.published_at');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)
    `);
    logger.info('✅ Created index on articles.category');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks(user_id)
    `);
    logger.info('✅ Created index on user_bookmarks.user_id');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmarks_article_id ON user_bookmarks(article_id)
    `);
    logger.info('✅ Created index on user_bookmarks.article_id');

    // Create user_preferences table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        preferred_categories TEXT NOT NULL,
        preferred_language TEXT NOT NULL DEFAULT 'english',
        font_size TEXT NOT NULL DEFAULT 'medium',
        theme TEXT NOT NULL DEFAULT 'light',
        notifications_enabled INTEGER NOT NULL DEFAULT 1,
        email_digest_frequency TEXT NOT NULL DEFAULT 'daily',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    logger.info('✅ Created user_preferences table');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)
    `);
    logger.info('✅ Created index on user_preferences.user_id');

    // Add hashtags column to articles if it doesn't exist
    try {
      await client.execute(`
        ALTER TABLE articles ADD COLUMN hashtags TEXT
      `);
      logger.info('✅ Added hashtags column to articles table');
    } catch (error: any) {
      if (error.message.includes('duplicate column')) {
        logger.info('ℹ️  Hashtags column already exists');
      } else {
        throw error;
      }
    }

    // Add upvote_count and downvote_count to articles
    for (const col of ['upvote_count INTEGER NOT NULL DEFAULT 0', 'downvote_count INTEGER NOT NULL DEFAULT 0']) {
      try {
        await client.execute(`ALTER TABLE articles ADD COLUMN ${col}`);
        logger.info(`✅ Added ${col.split(' ')[0]} column to articles`);
      } catch (e: any) {
        if (e.message.includes('duplicate column')) {
          logger.info(`ℹ️  ${col.split(' ')[0]} column already exists`);
        } else throw e;
      }
    }

    // Create article_reactions table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS article_reactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, article_id)
      )
    `);
    logger.info('✅ Created article_reactions table');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_article_reactions_user_article ON article_reactions(user_id, article_id)
    `);

    // Create user_alerts table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Created user_alerts table');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id)
    `);

    // Add sentiment and entities columns to articles
    for (const col of ['sentiment TEXT', 'entities TEXT']) {
      try {
        await client.execute(`ALTER TABLE articles ADD COLUMN ${col}`);
        logger.info(`✅ Added ${col.split(' ')[0]} column to articles`);
      } catch (e: any) {
        if (e.message.includes('duplicate column')) {
          logger.info(`ℹ️  ${col.split(' ')[0]} column already exists`);
        } else throw e;
      }
    }

    // Create pipeline_runs table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        processed INTEGER NOT NULL DEFAULT 0,
        saved INTEGER NOT NULL DEFAULT 0,
        errors INTEGER NOT NULL DEFAULT 0,
        telegram_sent INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        duration_ms INTEGER
      )
    `);
    logger.info('✅ Created pipeline_runs table');

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_source ON pipeline_runs(source)
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at)
    `);

    // Create notifications table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        article_title TEXT NOT NULL,
        article_url TEXT NOT NULL,
        keyword TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
    logger.info('✅ Created notifications table');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)
    `);

    // Add folder_id column to user_bookmarks
    try {
      await client.execute(`ALTER TABLE user_bookmarks ADD COLUMN folder_id TEXT`);
      logger.info('✅ Added folder_id column to user_bookmarks');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        logger.info('ℹ️  folder_id column already exists');
      } else throw e;
    }

    // Create bookmark_folders table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS bookmark_folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    logger.info('✅ Created bookmark_folders table');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id ON bookmark_folders(user_id)
    `);

    // Add why_it_matters column to articles
    try {
      await client.execute(`ALTER TABLE articles ADD COLUMN why_it_matters TEXT`);
      logger.info('✅ Added why_it_matters column to articles');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        logger.info('ℹ️  why_it_matters column already exists');
      } else throw e;
    }

    // Create article_highlights table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS article_highlights (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        text TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'yellow',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )
    `);
    logger.info('✅ Created article_highlights table');
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_article_highlights_user_id ON article_highlights(user_id)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_article_highlights_article_id ON article_highlights(article_id)`);

    // Create article_comments table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS article_comments (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        body TEXT NOT NULL,
        parent_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (article_id) REFERENCES articles(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    logger.info('✅ Created article_comments table');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_article_comments_article_id ON article_comments(article_id)
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_article_comments_user_id ON article_comments(user_id)
    `);

    // Add questions, bias_label, bias_score columns to articles
    for (const colDef of [
      'questions TEXT',
      'bias_label TEXT',
      'bias_score INTEGER',
    ]) {
      try {
        await client.execute(`ALTER TABLE articles ADD COLUMN ${colDef}`);
        logger.info(`✅ Added ${colDef.split(' ')[0]} column to articles`);
      } catch (e: any) {
        if (e.message.includes('duplicate column')) {
          logger.info(`ℹ️  ${colDef.split(' ')[0]} column already exists`);
        } else throw e;
      }
    }

    // Create user_streaks table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_article_read_date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    logger.info('✅ Created user_streaks table');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id)
    `);

    // Create user_dismissals table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_dismissals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )
    `);
    logger.info('✅ Created user_dismissals table');
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_dismissals_user_article ON user_dismissals(user_id, article_id)
    `);

    // Add last_login_at column to users
    try {
      await client.execute(`ALTER TABLE users ADD COLUMN last_login_at TEXT`);
      logger.info('✅ Added last_login_at column to users');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        logger.info('ℹ️  last_login_at column already exists');
      } else throw e;
    }

    // Add eli5_summary column to articles
    try {
      await client.execute(`ALTER TABLE articles ADD COLUMN eli5_summary TEXT`);
      logger.info('✅ Added eli5_summary column to articles');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        logger.info('ℹ️  eli5_summary column already exists');
      } else throw e;
    }

    // Create api_keys table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT 'My API Key',
        daily_limit INTEGER NOT NULL DEFAULT 1000,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT
      )
    `);
    logger.info('✅ Created api_keys table');
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);

    // Add embedding column for vector search (F32_BLOB, 384-dim from all-MiniLM-L6-v2)
    try {
      await client.execute(`ALTER TABLE articles ADD COLUMN embedding F32_BLOB(384)`);
      logger.info('✅ Added embedding column to articles');
    } catch (e: any) {
      if (e.message.includes('duplicate column') || e.message.includes('already exists')) {
        logger.info('ℹ️  embedding column already exists');
      } else throw e;
    }

    // Create vector index for ANN search
    try {
      await client.execute(
        `CREATE INDEX IF NOT EXISTS articles_embedding_idx ON articles(libsql_vector_idx(embedding))`
      );
      logger.info('✅ Created vector index on articles.embedding');
    } catch (e: any) {
      logger.warn('ℹ️  Vector index skipped (may not be supported on this Turso plan):', e.message);
    }

    logger.info('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
