'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import {
  SOLD_FEED_PAGE_SIZE,
  SOLD_INITIAL_FEED_PAGE_SIZE,
} from '@/utils/constants';
import type { HomePriceSortOrder } from '@/contexts/HomeProvinceContext';
import type { CurrencySymbol } from '@/utils/exchangeRates';
import {
  readSoldFeedCache,
  writeSoldFeedCache,
  clearSoldFeedCache,
} from '@/hooks/homeFeedStorage';

function createSoldFeedSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface PostListLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface SoldCursor {
  id: string;
  createdAt: string;
  isBoosted: boolean;
}

interface SoldCacheEntry {
  posts: any[];
  hasMore: boolean;
  cursor: SoldCursor | null;
}

function normalizeSoldCursor(cursor: SoldCursor | null | undefined): SoldCursor | null {
  if (!cursor || typeof cursor.id !== 'string' || typeof cursor.createdAt !== 'string') return null;
  return {
    id: cursor.id,
    createdAt: cursor.createdAt,
    isBoosted: !!cursor.isBoosted,
  };
}

const SOLD_CACHE_MAX = 6;
const soldCache: Record<string, SoldCacheEntry> = {};

function getSoldCacheKey(
  session: any,
  activeProfileId?: string | null,
  province?: string,
  minPriceKip?: number | null,
  maxPriceKip?: number | null,
  priceSortOrder?: HomePriceSortOrder,
): string {
  const uid = activeProfileId || session?.user?.id || 'guest';
  return [
    `sold:${uid}`,
    `province=${(province ?? '').trim() || 'all'}`,
    `min=${minPriceKip ?? 'none'}`,
    `max=${maxPriceKip ?? 'none'}`,
    `sort=${priceSortOrder || 'none'}`,
  ].join(':');
}

export interface UseSoldPostListDataOptions {
  session?: any;
  sessionReady?: boolean;
  activeProfileId?: string | null;
  userIdOrToken?: string;
  sharedLikedSaved?: PostListLikedSavedShared | null;
  province?: string;
  minPriceKip?: number | null;
  maxPriceKip?: number | null;
  minPriceDisplay?: number | null;
  maxPriceDisplay?: number | null;
  displayCurrency?: CurrencySymbol;
  priceSortOrder?: HomePriceSortOrder;
}

export interface UseSoldPostListDataReturn {
  posts: any[];
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  setPage: (page: number | ((prev: number) => number)) => void;
  setHasMore: (hasMore: boolean) => void;
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useSoldPostListData(options: UseSoldPostListDataOptions): UseSoldPostListDataReturn {
  const {
    session,
    sessionReady = true,
    activeProfileId,
    userIdOrToken,
    sharedLikedSaved,
    province,
    minPriceKip = null,
    maxPriceKip = null,
    minPriceDisplay = null,
    maxPriceDisplay = null,
    displayCurrency = '₭',
    priceSortOrder = '',
  } = options;

  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(sessionReady ? session : undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});

  const fetchIdRef = useRef(0);
  const cancelledRef = useRef(false);
  const cursorRef = useRef<SoldCursor | null>(null);
  const previousCacheKeyRef = useRef<string | null>(null);
  const feedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (sessionReady) setCurrentSession(session);
    else setCurrentSession(undefined);
  }, [session, sessionReady]);

  const cacheKey = useMemo(() => {
    if (currentSession === undefined) return null;
    return getSoldCacheKey(
      currentSession,
      activeProfileId,
      province,
      minPriceKip,
      maxPriceKip,
      priceSortOrder,
    );
  }, [currentSession, activeProfileId, province, minPriceKip, maxPriceKip, priceSortOrder]);

  useEffect(() => {
    if (!cacheKey) return;
    if (previousCacheKeyRef.current === cacheKey) return;

    previousCacheKeyRef.current = cacheKey;

    const cached = soldCache[cacheKey];
    if (cached) {
      setPosts(cached.posts);
      setHasMore(cached.hasMore);
      setPage(0);
      setLoadingMore(false);
      cursorRef.current = normalizeSoldCursor(cached.cursor);
      return;
    }

    cursorRef.current = null;
    setPage(0);
    setHasMore(true);
    setLoadingMore(false);

    // stale-while-revalidate: แสดง localStorage cache ทันที ถ้าไม่มี in-memory cache
    // (ไม่ใช้กับ price-filter เพราะ cache นี้เก็บเฉพาะ no-filter)
    const hasPriceModeLocal = !!(
      minPriceKip != null ||
      maxPriceKip != null ||
      minPriceDisplay != null ||
      maxPriceDisplay != null ||
      priceSortOrder
    );
    if (!hasPriceModeLocal) {
      const lsCache = readSoldFeedCache(province);
      if (lsCache && lsCache.posts.length > 0) {
        setPosts(lsCache.posts as any[]);
        setHasMore(lsCache.hasMore);
        return;
      }
    }

    setPosts([]);
  }, [cacheKey, province, minPriceKip, maxPriceKip, minPriceDisplay, maxPriceDisplay, priceSortOrder]);

  useEffect(() => {
    if (!cacheKey || loadingMore) return;
    const keys = Object.keys(soldCache);
    if (keys.length >= SOLD_CACHE_MAX) {
      const toDelete = keys.filter((k) => k !== cacheKey).slice(0, keys.length - SOLD_CACHE_MAX + 1);
      toDelete.forEach((k) => delete soldCache[k]);
    }
    soldCache[cacheKey] = {
      posts: [...posts],
      hasMore,
      cursor: cursorRef.current,
    };
  }, [cacheKey, loadingMore, posts, hasMore]);

  useEffect(() => {
    if (currentSession === undefined || sharedLikedSaved) return;

    let idOrToken: string | null = null;
    if (userIdOrToken && typeof userIdOrToken === 'string' && userIdOrToken !== 'null' && userIdOrToken !== 'undefined' && userIdOrToken !== '') {
      idOrToken = userIdOrToken;
    } else if (currentSession?.user?.id) {
      const uid = activeProfileId || currentSession.user.id;
      if (typeof uid === 'string' && uid !== 'null' && uid !== 'undefined' && uid !== '' && /^[0-9a-f-]{36}$/i.test(uid)) {
        idOrToken = uid;
      }
    }

    if (!idOrToken && typeof window !== 'undefined') {
      try {
        const token = getPrimaryGuestToken();
        if (token && typeof token === 'string' && token !== 'null' && token !== '') idOrToken = token;
      } catch {
        idOrToken = null;
      }
    }

    if (!idOrToken) return;

    const isUser = !!currentSession?.user?.id;
    const likesTable = isUser ? 'post_likes' : 'post_likes_guest';
    const likesColumn = isUser ? 'user_id' : 'guest_token';
    const savesTable = isUser ? 'post_saves' : 'post_saves_guest';
    const savesColumn = isUser ? 'user_id' : 'guest_token';

    let likesSavesCancelled = false;
    Promise.all([
      supabase.from(likesTable).select('post_id').eq(likesColumn, idOrToken),
      supabase.from(savesTable).select('post_id').eq(savesColumn, idOrToken),
    ]).then(([likedRes, savedRes]) => {
      if (likesSavesCancelled) return;
      if (likedRes.data) {
        const map: { [key: string]: boolean } = {};
        likedRes.data.forEach((item: { post_id: string }) => {
          map[item.post_id] = true;
        });
        setLikedPosts((prev) => ({ ...prev, ...map }));
      }
      if (savedRes.data) {
        const map: { [key: string]: boolean } = {};
        savedRes.data.forEach((item: { post_id: string }) => {
          map[item.post_id] = true;
        });
        setSavedPosts((prev) => ({ ...prev, ...map }));
      }
    });

    return () => {
      likesSavesCancelled = true;
    };
  }, [currentSession, activeProfileId, userIdOrToken, sharedLikedSaved]);

  const likedPostsOut = sharedLikedSaved ? sharedLikedSaved.likedPosts : likedPosts;
  const savedPostsOut = sharedLikedSaved ? sharedLikedSaved.savedPosts : savedPosts;
  const setLikedPostsOut = sharedLikedSaved ? sharedLikedSaved.setLikedPosts : setLikedPosts;
  const setSavedPostsOut = sharedLikedSaved ? sharedLikedSaved.setSavedPosts : setSavedPosts;

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (currentSession === undefined) return;
    if (loadingMore && !isInitial) return;

    const hasPriceMode = !!(minPriceKip != null || maxPriceKip != null || minPriceDisplay != null || maxPriceDisplay != null || priceSortOrder);

    const currentFetchId = ++fetchIdRef.current;
    setLoadingMore(true);

    if (isInitial) {
      cursorRef.current = null;
      // สร้าง seed ใหม่ทุก initial fetch เพื่อให้ server สุ่มลำดับใหม่
      if (!hasPriceMode) {
        feedSeedRef.current = createSoldFeedSeed();
      }
    }

    try {
      const body: {
        status: 'sold';
        pageSize: number;
        feedSeed?: string;
        cursorBoosted?: boolean;
        province?: string;
        minPriceKip?: number;
        maxPriceKip?: number;
        minPriceDisplay?: number;
        maxPriceDisplay?: number;
        displayCurrency?: CurrencySymbol;
        priceSortOrder?: HomePriceSortOrder;
        cursorId?: string;
        cursorCreatedAt?: string;
        startIndex?: number;
        endIndex?: number;
      } = {
        status: 'sold',
        pageSize: isInitial ? SOLD_INITIAL_FEED_PAGE_SIZE : SOLD_FEED_PAGE_SIZE,
      };

      if (province && province.trim() !== '') body.province = province.trim();
      if (minPriceKip != null) body.minPriceKip = minPriceKip;
      if (maxPriceKip != null) body.maxPriceKip = maxPriceKip;
      if (minPriceDisplay != null) body.minPriceDisplay = minPriceDisplay;
      if (maxPriceDisplay != null) body.maxPriceDisplay = maxPriceDisplay;
      if (minPriceDisplay != null || maxPriceDisplay != null) {
        body.displayCurrency = displayCurrency;
      }
      if (priceSortOrder) body.priceSortOrder = priceSortOrder;

      if (!hasPriceMode) {
        // Random path: prefer cursor pagination for deep-scroll performance.
        // Keep feedSeed stable across pages; otherwise ordering may reshuffle and cut hasMore early.
        if (!feedSeedRef.current) {
          feedSeedRef.current = createSoldFeedSeed();
        }
        // Fallback to startIndex/endIndex on first page.
        if (feedSeedRef.current) body.feedSeed = feedSeedRef.current;
        const pageSize = isInitial ? SOLD_INITIAL_FEED_PAGE_SIZE : SOLD_FEED_PAGE_SIZE;
        body.pageSize = pageSize;

        const useCursor = !isInitial && !!cursorRef.current?.id;
        if (useCursor) {
          body.cursorId = cursorRef.current!.id;
          body.cursorCreatedAt = cursorRef.current!.createdAt;
          body.cursorBoosted = !!cursorRef.current!.isBoosted;
        } else {
          const startIndex = isInitial ? 0 : posts.length;
          body.startIndex = startIndex;
          body.endIndex = startIndex + pageSize - 1;
        }
      } else {
        // Price-filter path: ใช้ cursor เดิม
        const useCursor = (!priceSortOrder || priceSortOrder === 'latest') && !isInitial && !!cursorRef.current;
        if (useCursor) {
          body.cursorId = cursorRef.current!.id;
          body.cursorCreatedAt = cursorRef.current!.createdAt;
        } else if (!isInitial) {
          const startIndex = posts.length;
          body.startIndex = startIndex;
          body.endIndex = startIndex + SOLD_FEED_PAGE_SIZE - 1;
        }
      }

      const response = await fetch('/api/posts/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (cancelledRef.current || fetchIdRef.current !== currentFetchId) return;
      if (!response.ok) {
        setHasMore(false);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (cancelledRef.current || fetchIdRef.current !== currentFetchId) return;

      if (typeof payload.feedSeed === 'string' && payload.feedSeed) {
        feedSeedRef.current = payload.feedSeed;
      }

      const fetchedPosts = Array.isArray(payload.posts) ? payload.posts : [];
      const filteredPosts = fetchedPosts.filter((post: any) => post.status === 'sold' && !post.is_hidden);

      const nextHasMore = typeof payload.hasMore === 'boolean'
        ? payload.hasMore
        : filteredPosts.length >= (isInitial ? SOLD_INITIAL_FEED_PAGE_SIZE : SOLD_FEED_PAGE_SIZE);

      if (isInitial) {
        setPosts(filteredPosts);
        // เขียน localStorage cache เฉพาะ no-price-filter
        if (!hasPriceMode && filteredPosts.length > 0) {
          try { writeSoldFeedCache(province, filteredPosts, nextHasMore); } catch {}
        }
      } else {
        setPosts((prev) => {
          const ids = new Set(prev.map((post: any) => String(post.id)));
          const toAdd = filteredPosts.filter((post: any) => !ids.has(String(post.id)));
          if (toAdd.length === 0) return prev;
          const next = [...prev, ...toAdd];
          // อัปเดต localStorage cache เพื่อให้ครั้งต่อไปมี pool ใหญ่ขึ้น
          if (!hasPriceMode) {
            try { writeSoldFeedCache(province, next, nextHasMore); } catch {}
          }
          return next;
        });
      }

      // Update cursor for next page. Price mode may provide nextCursor from API;
      // otherwise fallback to the last returned post.
      if (hasPriceMode) {
        const nextCursor = payload?.nextCursor;
        if (nextCursor && typeof nextCursor.id === 'string' && typeof nextCursor.createdAt === 'string') {
          cursorRef.current = {
            id: nextCursor.id,
            createdAt: nextCursor.createdAt,
            isBoosted: false,
          };
        } else if (filteredPosts.length > 0) {
          const last = filteredPosts[filteredPosts.length - 1] as { id?: string; created_at?: string; is_boosted?: boolean };
          if (typeof last.id === 'string' && typeof last.created_at === 'string') {
            cursorRef.current = {
              id: last.id,
              createdAt: last.created_at,
              isBoosted: !!last.is_boosted,
            };
          }
        }
      } else if (filteredPosts.length > 0) {
        const last = filteredPosts[filteredPosts.length - 1] as { id?: string; created_at?: string; is_boosted?: boolean };
        if (typeof last.id === 'string' && typeof last.created_at === 'string') {
          cursorRef.current = {
            id: last.id,
            createdAt: last.created_at,
            isBoosted: !!last.is_boosted,
          };
        }
      }

      setHasMore(nextHasMore);
    } catch (error) {
      console.error('useSoldPostListData fetchPosts failed:', error);
      if (isInitial) setPosts([]);
      setHasMore(false);
    } finally {
      if (!cancelledRef.current && fetchIdRef.current === currentFetchId) {
        setLoadingMore(false);
      }
    }
  }, [
    currentSession,
    loadingMore,
    province,
    minPriceKip,
    maxPriceKip,
    minPriceDisplay,
    maxPriceDisplay,
    displayCurrency,
    priceSortOrder,
    posts.length,
  ]);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    cursorRef.current = null;
    // ล้าง localStorage cache เพื่อให้ fetch ใหม่จาก server (เหมือน recommend feed)
    try { clearSoldFeedCache(province); } catch {}
    await fetchPosts(true);
  }, [fetchPosts, province]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPostUpdated = () => {
      void refreshData();
    };

    window.addEventListener('post:updated', onPostUpdated);
    return () => {
      window.removeEventListener('post:updated', onPostUpdated);
    };
  }, [refreshData]);

  return useMemo(() => ({
    posts,
    page,
    hasMore,
    loadingMore,
    session: currentSession,
    likedPosts: likedPostsOut,
    savedPosts: savedPostsOut,
    setPosts,
    setPage,
    setHasMore,
    setLikedPosts: setLikedPostsOut,
    setSavedPosts: setSavedPostsOut,
    fetchPosts,
    refreshData,
  }), [
    posts,
    page,
    hasMore,
    loadingMore,
    currentSession,
    likedPostsOut,
    savedPostsOut,
    setLikedPostsOut,
    setSavedPostsOut,
    fetchPosts,
    refreshData,
  ]);
}
