'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HOME_FEED_PAGE_SIZE, INITIAL_FEED_PAGE_SIZE } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';
import { preloadPostsVisibleImages } from '@/utils/imagePreload';
import {
  endHomeMotionTimer,
  markHomeMotionEvent,
  recordHomeMotionDuration,
  startHomeMotionTimer,
} from '@/lib/homeMotionProfiler';
import {
  clearHomeFeedStorage,
  getInitialPostsFromStorage,
  mergeJustPostedPost,
  prepareInitialHomeFeedState,
  readJustPostedRecommendPost,
  writeHomeFeedCache,
  type HomeFeedPost,
} from '@/hooks/homeFeedStorage';

export interface HomeLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface UseHomeFeedOptions {
  session?: unknown;
  /** เมื่อ true = รู้แล้วว่าใครล็อกอิน/เกสต์ แล้วค่อยโหลดไลก์/เซฟ */
  sessionReady?: boolean;
  /** แขวงที่เลือกจากฟิลเตอร์หน้า Home — ว่าง = แสดงทุกแขวง */
  province?: string;
  /** เรียกครั้งเดียวเมื่อโหลดโพสต์ชุดแรกเสร็จ (จาก cache หรือ API) */
  onInitialLoadDone?: () => void;
  /** ถ้ามี = ใช้ liked/saved นี้แทนโหลดเอง (ลด request ซ้ำในหน้าโฮม) */
  sharedLikedSaved?: HomeLikedSavedShared | null;
  /** เมื่อ false = หยุดโหลด (ใช้ตอนสลับออกจากหน้าโฮมแต่ยังเก็บหน้าไว้แบบ MainTabPanels) */
  isActive?: boolean;
}

interface UseHomeFeedReturn {
  posts: HomeFeedPost[];
  setPosts: React.Dispatch<React.SetStateAction<HomeFeedPost[]>>;
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  hasMore: boolean;
  setHasMore: (v: boolean) => void;
  loadingMore: boolean;
  session: unknown;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

function createClientFeedSeed(): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `seed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isBrowserReloadNavigation(): boolean {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  try {
    const navEntries = performance.getEntriesByType('navigation');
    const navEntry = Array.isArray(navEntries) ? (navEntries[0] as PerformanceNavigationTiming | undefined) : undefined;
    return navEntry?.type === 'reload';
  } catch {
    return false;
  }
}

export function useHomeFeed(options: UseHomeFeedOptions): UseHomeFeedReturn {
  const { session, sessionReady = true, province, onInitialLoadDone, sharedLikedSaved, isActive = true } = options;
  const [posts, setPosts] = useState<HomeFeedPost[]>(() => {
    if (isBrowserReloadNavigation()) return [];
    return getInitialPostsFromStorage(province);
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const currentSession = session ?? undefined;
  const likedPostsOut = sharedLikedSaved ? sharedLikedSaved.likedPosts : likedPosts;
  const savedPostsOut = sharedLikedSaved ? sharedLikedSaved.savedPosts : savedPosts;
  const setLikedPostsOut = sharedLikedSaved ? sharedLikedSaved.setLikedPosts : setLikedPosts;
  const setSavedPostsOut = sharedLikedSaved ? sharedLikedSaved.setSavedPosts : setSavedPosts;
  const fetchIdRef = useRef(0);
  /** ใช้คำนวณเวลาแสดง skeleton โหลดเพิ่มขั้นต่ำ — API ตอบเร็วมากจะไม่ให้ loadingMore=false ทันทีจน skeleton ไม่ทัน paint */
  const loadMoreStartedAtRef = useRef<number | null>(null);
  const initialLoadDoneFiredRef = useRef(false);
  /** ยกเลิกการโหลดเมื่อออกจากหน้า — ใช้ใน cleanup และก่อน setState หลัง await */
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onInitialLoadDoneRef = useRef(onInitialLoadDone);
  const feedSeedRef = useRef<string | null>(null);
  const forceNewSeedOnNextInitialFetchRef = useRef(isBrowserReloadNavigation());

  useEffect(() => {
    onInitialLoadDoneRef.current = onInitialLoadDone;
  }, [onInitialLoadDone]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    } else {
      cancelledRef.current = false;
    }
  }, [isActive]);
  /** ใช้เป็น startIndex ตอนโหลดเพิ่ม — อัปเดตตาม posts.length เพื่อไม่ข้ามรายการเมื่อ backend คืนน้อยกว่าที่ขอ */
  const postsLengthRef = useRef(0);
  postsLengthRef.current = posts.length;
  /** โพสสุดท้ายของลิสต์ — ใช้เป็น cursor ตอนโหลดเพิ่ม (cursor-based = โหลดเร็วเท่ากันทุกหน้า) */
  const lastPostRef = useRef<{ id: string; is_boosted: boolean; created_at: string } | null>(null);
  if (posts.length > 0) {
    const last = posts[posts.length - 1];
    if (
      last &&
      typeof last.id === 'string' &&
      typeof last.is_boosted === 'boolean' &&
      typeof last.created_at === 'string'
    ) {
      lastPostRef.current = { id: last.id, is_boosted: last.is_boosted, created_at: last.created_at };
    }
  }

  const fireInitialLoadDone = useCallback(() => {
    if (initialLoadDoneFiredRef.current) return;
    initialLoadDoneFiredRef.current = true;
    onInitialLoadDoneRef.current?.();
  }, []);

  useEffect(() => {
    if (sharedLikedSaved) return;
    if (!sessionReady) return;
    if (currentSession === undefined) return;
    let idOrToken: string | null = null;
    if (currentSession?.user?.id) {
      const uid = currentSession.user.id;
      if (typeof uid === 'string' && uid !== 'null' && /^[0-9a-f-]{36}$/i.test(uid)) {
        idOrToken = uid;
      }
    }
    if (!idOrToken && typeof window !== 'undefined') {
      try {
        const token = getPrimaryGuestToken();
        if (token && typeof token === 'string' && token !== 'null') idOrToken = token;
      } catch {}
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
        likedRes.data.forEach((item: { post_id: string }) => { map[item.post_id] = true; });
        setLikedPosts(prev => ({ ...prev, ...map }));
      }
      if (savedRes.data) {
        const map: { [key: string]: boolean } = {};
        savedRes.data.forEach((item: { post_id: string }) => { map[item.post_id] = true; });
        setSavedPosts(prev => ({ ...prev, ...map }));
      }
    });
    return () => { likesSavesCancelled = true; };
  }, [sessionReady, currentSession, sharedLikedSaved]);

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number, backgroundRefresh = false) => {
    if (loadingMore && !isInitial) return;
    // Explicit refresh/reload: force a new seed so backend bypasses cached ordering.
    if (isInitial && forceNewSeedOnNextInitialFetchRef.current) {
      feedSeedRef.current = createClientFeedSeed();
      forceNewSeedOnNextInitialFetchRef.current = false;
    } else if (isInitial && !backgroundRefresh && !feedSeedRef.current) {
      // First initial fetch after cold mount should still have a stable seed for pagination.
      feedSeedRef.current = createClientFeedSeed();
    }
    const fetchTimer = startHomeMotionTimer('feed-fetch', isInitial ? 'initial-feed-fetch' : 'load-more-feed-fetch');
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const currentFetchId = ++fetchIdRef.current;
    if (!(isInitial && backgroundRefresh)) {
      if (!isInitial) loadMoreStartedAtRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      else loadMoreStartedAtRef.current = null;
      setLoadingMore(true);
    }
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : page);
    // โหลดเพิ่มใช้ offset จากจำนวนโพสต์จริง (ไม่ใช้ page) เพื่อไม่ข้ามรายการเมื่อ backend คืนน้อยกว่าที่ขอ
    const rangeStart = currentPage === 0 ? 0 : postsLengthRef.current;
    const pageSize = isInitial ? INITIAL_FEED_PAGE_SIZE : HOME_FEED_PAGE_SIZE;
    const rangeEnd = rangeStart + pageSize - 1;

    try {
      const url = '/api/posts/feed';
      const body: {
        startIndex?: number;
        endIndex?: number;
        province?: string;
        cursorId?: string;
        cursorBoosted?: boolean;
        cursorCreatedAt?: string;
        pageSize?: number;
        feedSeed?: string;
        guestToken?: string;
      } = {};
      if (province && province.trim() !== '') body.province = province.trim();
      if (feedSeedRef.current) body.feedSeed = feedSeedRef.current;

      // Send guest token so the server can personalise the feed for guests.
      // (Logged-in userId is derived server-side from the session cookie.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(currentSession as any)?.user?.id) {
        try {
          const token = getPrimaryGuestToken();
          if (token && typeof token === 'string' && token !== 'null') {
            body.guestToken = token;
          }
        } catch {
          // ignore
        }
      }

      // โหลดเพิ่ม: ใช้ cursor แทน offset เพื่อให้เร็วเท่ากันไม่ว่าเลื่อนลึกแค่ไหน
      const cursor = !isInitial ? lastPostRef.current : null;
      if (cursor) {
        body.cursorId = cursor.id;
        body.cursorBoosted = cursor.is_boosted;
        body.cursorCreatedAt = cursor.created_at;
        body.pageSize = pageSize;
      } else {
        body.startIndex = rangeStart;
        body.endIndex = rangeEnd;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;
      const data = await res.json().catch(() => ({}));
      if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;
      if (typeof data.feedSeed === 'string' && data.feedSeed) {
        feedSeedRef.current = data.feedSeed;
      }
      const postIds: string[] = Array.isArray(data.postIds) ? data.postIds : [];
      // ถ้า API บอก hasMore มาแล้ว ให้เชื่อตามนั้น
      // ไม่ควรถือว่า "หน้าไม่เต็มแต่ยังมีข้อมูล" = มีหน้าถัดไป เพราะจะทำให้ท้ายฟีดวนโหลด skeleton ไม่หยุด
      const nextHasMore =
        typeof data.hasMore === 'boolean' ? data.hasMore : postIds.length >= pageSize;
      const apiPosts: HomeFeedPost[] = Array.isArray(data.posts)
        ? (data.posts as HomeFeedPost[])
        : [];

      setHasMore(nextHasMore);

      if (postIds.length === 0) {
        if (isInitial) {
          setPosts([]);
          fireInitialLoadDone();
        }
        return;
      }

      let ordered: HomeFeedPost[];
      if (apiPosts.length > 0) {
        ordered = apiPosts;
      } else {
        const hydrateTimer = startHomeMotionTimer('feed-hydrate', 'supabase-post-hydrate');
        const { data: postsData, error } = await supabase
          .from('cars')
          .select(POST_WITH_PROFILE_SELECT)
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;
        if (error) return;
        const order = new Map(postIds.map((id, i) => [String(id), i]));
        const hydratedPosts = await attachEffectiveWhatsAppPhones(supabase, (postsData || []) as HomeFeedPost[]);
        ordered = hydratedPosts.filter(
          (post) => post.status === 'recommend' && !post.is_hidden,
        );
        ordered.sort((a, b) => {
          const ai = order.get(String(a.id)) ?? 1e9;
          const bi = order.get(String(b.id)) ?? 1e9;
          return ai - bi;
        });
        endHomeMotionTimer(hydrateTimer, {
          isInitial,
          postCount: ordered.length,
          from: 'supabase',
        });
      }

      if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;

      if (isInitial) {
        // ใช้โพสที่เก็บไว้จาก create-post แสดงครั้งเดียว ไม่ fetch แยก เพื่อไม่ให้จอกระพริบ
        let initialList = ordered;
        try {
          const justPostedPost = readJustPostedRecommendPost();
          if (justPostedPost) {
            initialList = mergeJustPostedPost(ordered, justPostedPost);
          }
          clearHomeFeedStorage();
        } catch {
          // ignore
        }
        setPosts(initialList);
        preloadPostsVisibleImages(initialList, 2);
        fireInitialLoadDone();
        markHomeMotionEvent('initial-feed-ready', {
          postCount: initialList.length,
          backgroundRefresh,
        });
        try {
          writeHomeFeedCache(province, ordered, nextHasMore);
        } catch {
          // ignore
        }
      } else {
        setPosts((prev) => {
          const ids = new Set(prev.map((post) => String(post.id)));
          const newOnes = ordered.filter((post) => !ids.has(String(post.id)));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        });
        recordHomeMotionDuration('feed-hydrate', 'append-feed-posts', 0, {
          appendedCount: ordered.length,
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      throw e;
    } finally {
      endHomeMotionTimer(fetchTimer, {
        isInitial,
        backgroundRefresh,
        page: currentPage,
        postCount: postsLengthRef.current,
      });
      if (!cancelledRef.current && fetchIdRef.current === currentFetchId) {
        if (isInitial) {
          loadMoreStartedAtRef.current = null;
          setLoadingMore(false);
        } else {
          const MIN_LOAD_MORE_SKELETON_MS = 200;
          const start = loadMoreStartedAtRef.current;
          loadMoreStartedAtRef.current = null;
          const elapsed =
            start != null && typeof performance !== 'undefined' ? performance.now() - start : MIN_LOAD_MORE_SKELETON_MS;
          const remaining = Math.max(0, MIN_LOAD_MORE_SKELETON_MS - elapsed);
          if (remaining > 0) {
            window.setTimeout(() => {
              if (!cancelledRef.current && fetchIdRef.current === currentFetchId) setLoadingMore(false);
            }, remaining);
          } else {
            setLoadingMore(false);
          }
        }
      }
    }
  }, [page, loadingMore, province, fireInitialLoadDone]);
  const fetchPostsRef = useRef(fetchPosts);
  useEffect(() => { fetchPostsRef.current = fetchPosts; }, [fetchPosts]);
  const initialLoadFromCacheRef = useRef(false);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    forceNewSeedOnNextInitialFetchRef.current = true;
    feedSeedRef.current = null;
    try {
      clearHomeFeedStorage({ clearCache: true });
    } catch {
      // ignore
    }
    await fetchPosts(true);
  }, [fetchPosts]);

  useEffect(() => {
    initialLoadFromCacheRef.current = false;
    feedSeedRef.current = null;
    const shouldBypassCachedFeed = isBrowserReloadNavigation();
    if (shouldBypassCachedFeed) {
      forceNewSeedOnNextInitialFetchRef.current = true;
    }
    const { fromCache, initialPosts, hasMore: initialHasMore, justPostedPost } =
      prepareInitialHomeFeedState(province);
    const useCachedFeed = fromCache && !shouldBypassCachedFeed;

    if (useCachedFeed) {
      setPosts(initialPosts);
      setLoadingMore(false);
      preloadPostsVisibleImages(initialPosts, 2);
      setHasMore(initialHasMore);
      initialLoadFromCacheRef.current = true;
      fireInitialLoadDone();
      recordHomeMotionDuration('feed-cache', 'initial-feed-cache-hit', 0, {
        cachedPosts: initialPosts.length,
        province: province ?? '',
      });
    } else {
      if (shouldBypassCachedFeed) {
        try {
          clearHomeFeedStorage({ clearCache: true });
        } catch {
          // ignore
        }
      }
      setPosts(initialPosts);
      setLoadingMore(!justPostedPost);
      setHasMore(true);
      recordHomeMotionDuration('feed-cache', 'initial-feed-cache-miss', 0, {
        initialPosts: initialPosts.length,
        province: province ?? '',
      });
      if (justPostedPost) {
        fireInitialLoadDone();
      }
    }
    setPage(0);
    // มีแคชหรือมีโพสที่พึ่งโพสอยู่แล้ว = โหลดในพื้นหลังโดยไม่แสดงสปินเนอร์ (ไม่กระพริบ)
    const backgroundOnly = initialLoadFromCacheRef.current || !!justPostedPost;
    if (backgroundOnly) {
      fetchPostsRef.current(true, undefined, true);
    } else {
      fetchPostsRef.current(true);
    }
  }, [province, fireInitialLoadDone]);

  const lastFetchedPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (page === 0 || loadingMore) return;
    if (lastFetchedPageRef.current === page) return;
    lastFetchedPageRef.current = page;
    fetchPostsRef.current(false, page);
  }, [page, loadingMore]);
  useEffect(() => {
    if (page === 0) lastFetchedPageRef.current = null;
  }, [page]);

  return {
    posts,
    setPosts,
    page,
    setPage,
    hasMore,
    setHasMore,
    loadingMore,
    session: currentSession,
    likedPosts: likedPostsOut,
    savedPosts: savedPostsOut,
    setLikedPosts: setLikedPostsOut,
    setSavedPosts: setSavedPostsOut,
    fetchPosts,
    refreshData,
  };
}
