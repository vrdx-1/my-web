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

/** อายุ cache ฟีดใน Redis (วินาที) — 1 นาที */
export const FEED_CACHE_TTL_SEC = 1 * 60; // 60

/** จำนวนโพสต์ (โพสล่าสุด + โพส Boost) ที่เก็บใน cache ชุดเดียว */
export const FEED_TOP_CACHE_SIZE = 1000;

export type FeedCachePayload = {
  postIds: string[];
  hasMore: boolean;
  posts: unknown[];
};

const FEED_CACHE_PREFIX = 'feed:';
const FEED_TOP100_PREFIX = 'feed:top100:';

export function feedCacheKey(startIndex: number, endIndex: number, province?: string): string {
  const p = province?.trim() || 'all';
  return `${FEED_CACHE_PREFIX}${startIndex}:${endIndex}:${p}`;
}

/** คีย์ cache ชุดโพสแรก (ล่าสุด + Boost ตาม FEED_TOP_CACHE_SIZE) ต่อ province */
export function feedTop100CacheKey(province?: string): string {
  const p = province?.trim() || 'all';
  return `${FEED_TOP100_PREFIX}${p}`;
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

/** ดึง cache โพสชุดแรก (โพสล่าสุด + Boost) */
export async function getFeedTop100FromCache(province?: string): Promise<FeedCachePayload | null> {
  const key = feedTop100CacheKey(province);
  return getFeedFromCache(key);
}

/** เก็บโพสชุดแรก (โพสล่าสุด + Boost) ลง cache อายุ 1 นาที */
export async function setFeedTop100Cache(province: string | undefined, payload: FeedCachePayload): Promise<void> {
  const key = feedTop100CacheKey(province);
  return setFeedCache(key, payload);
}
