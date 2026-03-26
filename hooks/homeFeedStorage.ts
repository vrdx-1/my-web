'use client';

import { FEED_CACHE_MAX_AGE_MS, HOME_FEED_PAGE_SIZE } from '@/utils/constants';

export const HOME_FEED_CACHE_KEY = 'home_feed_cache';
const JUST_POSTED_POST_KEY = 'just_posted_post';
const JUST_POSTED_POST_ID_KEY = 'just_posted_post_id';
const JUST_POSTED_PRELOAD_KEY = 'just_posted_post_preload';

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
      return cachedFeed ? cachedFeed.posts.slice(0, HOME_FEED_PAGE_SIZE) : [];
    }

    if (!cachedFeed) {
      return [justPostedPost];
    }

    return mergeJustPostedPost(cachedFeed.posts.slice(0, HOME_FEED_PAGE_SIZE), justPostedPost);
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

  const cachedPosts = cachedFeed.posts.slice(0, HOME_FEED_PAGE_SIZE);
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