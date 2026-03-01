import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { logger } from '../utils/logger';

const connectionString = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

if (!authToken) {
  throw new Error('DATABASE_AUTH_TOKEN environment variable is not set');
}

// Create Turso client
const client = createClient({
  url: connectionString,
  authToken: authToken,
});

// Initialize Drizzle ORM
export const db = drizzle(client);

// Test connection on startup
export async function initializeDatabase() {
  try {
    await client.execute('SELECT 1');
    logger.info('✅ Database connection established (Turso)');
    return true;
  } catch (error: any) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}
