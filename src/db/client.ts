import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from '../utils/logger';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client with connection pooling
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

// Initialize Drizzle ORM
export const db = drizzle(client);

// Test connection on startup
export async function initializeDatabase() {
  try {
    await client`SELECT 1`;
    logger.info('✅ Database connection established');
    return true;
  } catch (error: any) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}

export { client };
