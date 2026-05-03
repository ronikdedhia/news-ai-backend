import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger';

const hasCredentials = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = hasCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

if (!hasCredentials) {
  logger.warn('⚠️  Redis not configured — caching disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch (e: any) {
    logger.warn(`Redis GET failed for ${key}: ${e.message}`);
    return null;
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, value as any);
  } catch (e: any) {
    logger.warn(`Redis SET failed for ${key}: ${e.message}`);
  }
}

export async function deleteCached(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (e: any) {
    logger.warn(`Redis DEL failed: ${e.message}`);
  }
}

export async function incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
  if (!redis) return 0;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  } catch (e: any) {
    logger.warn(`Redis INCR failed for ${key}: ${e.message}`);
    return 0;
  }
}
