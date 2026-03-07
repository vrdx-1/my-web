/**
 * Upstash Redis cache — ใช้ cache feed ให้โหลดเร็ว
 * ถ้าไม่มี UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN จะไม่ใช้ cache (no-op)
 */

import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function createClient(): Redis | null {
  if (url && token) {
    return new Redis({ url, token });
  }
  return null;
}

let client: Redis | null | undefined = undefined;

export function getRedis(): Redis | null {
  if (client === undefined) {
    client = createClient();
  }
  return client;
}

/** อายุ cache ฟีดใน Redis (วินาที) — 3 นาที */
export const FEED_CACHE_TTL_SEC = 180;

export type FeedCachePayload = {
  postIds: string[];
  hasMore: boolean;
  posts: unknown[];
};

const FEED_CACHE_PREFIX = 'feed:';

export function feedCacheKey(startIndex: number, endIndex: number, province?: string): string {
  const p = province?.trim() || 'all';
  return `${FEED_CACHE_PREFIX}${startIndex}:${endIndex}:${p}`;
}

export async function getFeedFromCache(key: string): Promise<FeedCachePayload | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(key);
    if (raw && typeof raw === 'object' && Array.isArray((raw as FeedCachePayload).postIds)) {
      return raw as FeedCachePayload;
    }
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw) as FeedCachePayload;
      if (Array.isArray(parsed?.postIds)) return parsed;
    }
  } catch (_) {
    // cache miss or error → fallback to DB
  }
  return null;
}

export async function setFeedCache(key: string, payload: FeedCachePayload): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(payload), { ex: FEED_CACHE_TTL_SEC });
  } catch (_) {
    // ignore cache write errors
  }
}
