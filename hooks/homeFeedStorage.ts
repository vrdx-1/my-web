'use client';

import { FEED_CACHE_MAX_AGE_MS, INITIAL_FEED_PAGE_SIZE } from '@/utils/constants';

export const HOME_FEED_CACHE_KEY = 'home_feed_cache';
const JUST_POSTED_POST_KEY = 'just_posted_post';
const JUST_POSTED_POST_ID_KEY = 'just_posted_post_id';
const JUST_POSTED_PRELOAD_KEY = 'just_posted_post_preload';
const HOME_FEED_SEEN_PREFIX = 'home_feed_seen';
const HOME_FEED_SEEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const HOME_FEED_SEEN_MAX_IDS = 2000;

interface HomeFeedSeenRecord {
  ts: number;
  ids: string[];
}

interface HomeFeedCacheRecord {
  province?: string;
  posts: HomeFeedPost[];
  hasMore?: boolean;
  ts?: number;
}

export interface HomeFeedPost {
  id?: string | number;
  status?: string;
  is_hidden?: boolean;
  images?: unknown[];
  is_boosted?: boolean;
  created_at?: string;
  _preloadImages?: unknown;
  [key: string]: unknown;
}

function parseStoredJson(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeScopeProvince(province?: string): string {
  return (province || '').trim() || 'all';
}

function getHomeFeedSeenKey(province: string, actorKey: string): string {
  return `${HOME_FEED_SEEN_PREFIX}:${province}:${actorKey}`;
}

export function resolveHomeFeedActorKey(userId?: string | null, guestToken?: string | null): string | null {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (uid) return `user:${uid}`;
  const gid = typeof guestToken === 'string' ? guestToken.trim() : '';
  if (gid) return `guest:${gid}`;
  return null;
}

export function readHomeFeedSeenPostIds(
  province: string | undefined,
  actorKey: string,
  maxIds = 600,
): string[] {
  if (typeof window === 'undefined') return [];
  const scopeProvince = normalizeScopeProvince(province);
  const key = getHomeFeedSeenKey(scopeProvince, actorKey);
  const parsed = parseStoredJson(window.localStorage.getItem(key)) as HomeFeedSeenRecord | null;
  if (!parsed || !Array.isArray(parsed.ids)) return [];

  const age = Date.now() - Number(parsed.ts || 0);
  if (!Number.isFinite(age) || age < 0 || age > HOME_FEED_SEEN_MAX_AGE_MS) {
    window.localStorage.removeItem(key);
    return [];
  }

  return parsed.ids.slice(0, Math.max(0, maxIds));
}

export function markHomeFeedSeenPostIds(
  province: string | undefined,
  actorKey: string,
  postIds: string[],
): void {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(postIds) || postIds.length === 0) return;

  const scopeProvince = normalizeScopeProvince(province);
  const key = getHomeFeedSeenKey(scopeProvince, actorKey);
  const parsed = parseStoredJson(window.localStorage.getItem(key)) as HomeFeedSeenRecord | null;
  const existing = Array.isArray(parsed?.ids) ? parsed!.ids : [];

  const next = [...existing];
  const seen = new Set(existing);
  for (const id of postIds) {
    const value = String(id || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }

  const limited = next.slice(-HOME_FEED_SEEN_MAX_IDS);
  const payload: HomeFeedSeenRecord = { ts: Date.now(), ids: limited };
  window.localStorage.setItem(key, JSON.stringify(payload));
}

function attachPreloadedImages(post: HomeFeedPost) {
  if (typeof sessionStorage === 'undefined' || !Array.isArray(post?.images)) return post;
  const preloadArr = parseStoredJson(sessionStorage.getItem(JUST_POSTED_PRELOAD_KEY));
  if (Array.isArray(preloadArr) && preloadArr.length === post.images.length) {
    post._preloadImages = preloadArr;
  }
  return post;
}

function readCachedFeed(province?: string): HomeFeedCacheRecord | null {
  if (typeof window === 'undefined') return null;
  const parsed = parseStoredJson(window.localStorage.getItem(HOME_FEED_CACHE_KEY));
  if (!parsed || parsed.province !== province || !Array.isArray(parsed.posts)) {
    return null;
  }

  const age = Date.now() - (parsed.ts || 0);
  if (age >= FEED_CACHE_MAX_AGE_MS) {
    return null;
  }

  return parsed as HomeFeedCacheRecord;
}

export function readJustPostedRecommendPost() {
  if (typeof window === 'undefined') return null;
  const justPostedPost = parseStoredJson(window.localStorage.getItem(JUST_POSTED_POST_KEY));
  if (!justPostedPost || justPostedPost.status !== 'recommend' || justPostedPost.is_hidden) {
    return null;
  }

  return attachPreloadedImages(justPostedPost as HomeFeedPost);
}

export function mergeJustPostedPost(posts: HomeFeedPost[], justPostedPost: HomeFeedPost) {
  if (!justPostedPost) return posts;
  const rest = posts.filter((post) => String(post.id) !== String(justPostedPost.id));
  return [justPostedPost, ...rest];
}

export function getInitialPostsFromStorage(province?: string): HomeFeedPost[] {
  if (typeof window === 'undefined') return [];

  try {
    const justPostedPost = readJustPostedRecommendPost();
    const cachedFeed = readCachedFeed(province);

    if (!justPostedPost) {
      return cachedFeed ? cachedFeed.posts.slice(0, INITIAL_FEED_PAGE_SIZE) : [];
    }

    if (!cachedFeed) {
      return [justPostedPost];
    }

    return mergeJustPostedPost(cachedFeed.posts.slice(0, INITIAL_FEED_PAGE_SIZE), justPostedPost);
  } catch {
    return [];
  }
}

export function prepareInitialHomeFeedState(province?: string) {
  const justPostedPost = readJustPostedRecommendPost();
  const cachedFeed = readCachedFeed(province);

  if (!cachedFeed) {
    return {
      fromCache: false,
      initialPosts: justPostedPost ? [justPostedPost] : [],
      hasMore: true,
      justPostedPost,
    };
  }

  const cachedPosts = cachedFeed.posts.slice(0, INITIAL_FEED_PAGE_SIZE);
  return {
    fromCache: true,
    initialPosts: justPostedPost ? mergeJustPostedPost(cachedPosts, justPostedPost) : cachedPosts,
    hasMore: !!cachedFeed.hasMore,
    justPostedPost,
  };
}

export function clearHomeFeedStorage(options?: { clearCache?: boolean }) {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(JUST_POSTED_POST_KEY);
  window.localStorage.removeItem(JUST_POSTED_POST_ID_KEY);
  if (options?.clearCache) {
    window.localStorage.removeItem(HOME_FEED_CACHE_KEY);
  }
  try {
    sessionStorage.removeItem(JUST_POSTED_PRELOAD_KEY);
  } catch {
    // ignore
  }
}

export function writeHomeFeedCache(
  province: string | undefined,
  posts: HomeFeedPost[],
  hasMore: boolean,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    HOME_FEED_CACHE_KEY,
    JSON.stringify({
      province,
      posts,
      hasMore,
      ts: Date.now(),
    }),
  );
}