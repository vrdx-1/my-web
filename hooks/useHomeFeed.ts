'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HOME_FEED_PAGE_SIZE, INITIAL_FEED_PAGE_SIZE, FIRST_BATCH_FEED_PAGE_SIZE } from '@/utils/constants';
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
  readHomeFeedSeenPostIds,
  markHomeFeedSeenPostIds,
  mergeJustPostedPost,
  prepareInitialHomeFeedState,
  readJustPostedRecommendPost,
  migrateHomeFeedSeenPostIds,
  resolveHomeFeedActorKey,
  writeHomeFeedCache,
  type HomeFeedPost,
} from '@/hooks/homeFeedStorage';
import type { HomePriceSortOrder } from '@/contexts/HomeProvinceContext';
import {
  DEFAULT_EXCHANGE_RATES,
  type CurrencySymbol,
  normalizeExchangeRates,
  toLakPrice,
} from '../utils/exchangeRates';

export interface HomeLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface UseHomeFeedOptions {
  session?: unknown;
  activeProfileId?: string | null;
  authUserId?: string | null;
  /** เมื่อ true = รู้แล้วว่าใครล็อกอิน/เกสต์ แล้วค่อยโหลดไลก์/เซฟ */
  sessionReady?: boolean;
  /** แขวงที่เลือกจากฟิลเตอร์หน้า Home — ว่าง = แสดงทุกแขวง */
  province?: string;
  /** ช่วงราคาฟิลเตอร์ (หน่วย: ກີບ) */
  minPriceKip?: number | null;
  maxPriceKip?: number | null;
  /** สกุลเงินที่ใช้ในหน้าฟิลเตอร์ */
  displayCurrency?: CurrencySymbol;
  priceSortOrder?: HomePriceSortOrder;
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
  // HYBRID FEED LOGIC: ใช้ cache เสมอ + ดึง boost สดจาก DB เสมอ
  // - backend จะ merge cache + boost สด และจัดเรียง owner boost ให้อยู่บนสุดถ้า user เป็นเจ้าของ
  // - ต้องส่ง activeProfileId/authUserId เสมอ เพื่อให้ backend จัด feed owner boost ให้ถูกต้อง
  const {
    session,
    activeProfileId,
    authUserId,
    sessionReady = true,
    province,
    minPriceKip = null,
    maxPriceKip = null,
    displayCurrency = '₭',
    priceSortOrder = '',
    onInitialLoadDone,
    sharedLikedSaved,
    isActive = true,
  } = options;
  const hasPriceFilter = minPriceKip != null || maxPriceKip != null;
  const hasPriceSort = priceSortOrder === 'asc' || priceSortOrder === 'desc' || priceSortOrder === 'latest';
  const shouldBypassInitialCache = hasPriceFilter || hasPriceSort;
  const shouldPersistHomeFeedCache = !shouldBypassInitialCache;
  const [clientExchangeRates, setClientExchangeRates] = useState(DEFAULT_EXCHANGE_RATES);
  const [posts, setPosts] = useState<HomeFeedPost[]>(() => {
    if (isBrowserReloadNavigation() || shouldBypassInitialCache) return [];
    return getInitialPostsFromStorage(province);
  });
  const [page, setPage] = useState(0);
  // state สำหรับ track ว่าโหลด batch 5 โพสต์แรกแล้วหรือยัง
  const [firstBatchLoaded, setFirstBatchLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const currentSession = session ?? undefined;
  const currentSessionUserId =
    typeof (currentSession as { user?: { id?: string } } | undefined)?.user?.id === 'string'
      ? (currentSession as { user?: { id?: string } }).user?.id || null
      : null;
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
  const lastResolvedActorKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onInitialLoadDoneRef.current = onInitialLoadDone;
  }, [onInitialLoadDone]);

  useEffect(() => {
    const shouldLoadExchangeRates =
      displayCurrency !== '₭' && (minPriceKip != null || maxPriceKip != null);
    if (!shouldLoadExchangeRates) return;

    let active = true;

    const loadExchangeRates = async () => {
      const { data } = await supabase
        .from('exchange_rates')
        .select('lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      setClientExchangeRates(normalizeExchangeRates(data));
    };

    loadExchangeRates();

    return () => {
      active = false;
    };
  }, [displayCurrency, minPriceKip, maxPriceKip]);

  // หลัง initial load 2 โพสต์แรกเสร็จ ให้ trigger โหลด 5 โพสต์ถัดไปทันที (ถ้ายังไม่โหลด)
  useEffect(() => {
    if (posts.length === INITIAL_FEED_PAGE_SIZE && !firstBatchLoaded && hasMore) {
      setFirstBatchLoaded(true);
      // โหลด 5 โพสต์ถัดไป
      (async () => {
        await fetchPosts(false, undefined, false, FIRST_BATCH_FEED_PAGE_SIZE);
      })();
    }
  }, [posts.length, firstBatchLoaded, hasMore]);

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
    if (currentSessionUserId) {
      const uid = currentSessionUserId;
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
    const isUser = !!currentSessionUserId;
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

  // เพิ่ม pageSizeOverride สำหรับ batch 5 โพสต์แรก
  // ดึง feed แบบ hybrid: cache เสมอ + boost สดเสมอ (backend merge ให้)
  // ถ้า user เป็นเจ้าของ boost backend จะจัด boost owner ให้อยู่บนสุด
  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number, backgroundRefresh = false, pageSizeOverride?: number) => {
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
    let pageSize = isInitial ? INITIAL_FEED_PAGE_SIZE : HOME_FEED_PAGE_SIZE;
    if (!isInitial && pageSizeOverride) pageSize = pageSizeOverride;
    const rangeEnd = rangeStart + pageSize - 1;

    try {
      if (priceSortOrder === 'latest') {
        let latestQuery = supabase
          .from('cars')
          .select(POST_WITH_PROFILE_SELECT)
          .eq('status', 'recommend')
          .or('is_hidden.eq.false,is_hidden.is.null');

        if (province && province.trim() !== '') {
          latestQuery = latestQuery.eq('province', province.trim());
        }
        if (minPriceKip != null) {
          latestQuery = latestQuery.gte('approx_price_lak', minPriceKip);
        }
        if (maxPriceKip != null) {
          latestQuery = latestQuery.lte('approx_price_lak', maxPriceKip);
        }

        const { data: latestRows, error: latestError } = await latestQuery
          .order('created_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeStart + pageSize);

        if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;
        if (latestError) throw latestError;

        const latestList = Array.isArray(latestRows) ? latestRows as HomeFeedPost[] : [];
        const nextHasMore = latestList.length > pageSize;
        const pageRows = nextHasMore ? latestList.slice(0, pageSize) : latestList;
        const orderedLatest = await attachEffectiveWhatsAppPhones(supabase, pageRows);

        if (cancelledRef.current || currentFetchId !== fetchIdRef.current) return;

        setHasMore(nextHasMore);

        if (isInitial) {
          setPosts(orderedLatest.filter((post) => !post.is_hidden));
          preloadPostsVisibleImages(orderedLatest, 2);
          fireInitialLoadDone();
        } else {
          setPosts((prev) => {
            const ids = new Set(prev.map((post) => String(post.id)));
            const newOnes = orderedLatest
              .filter((post) => !post.is_hidden)
              .filter((post) => !ids.has(String(post.id)));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }

        return;
      }

      const url = '/api/posts/feed';
      const toDisplayPriceValue = (lakValue: number): number => {
        if (displayCurrency === '฿') return Math.round(lakValue * DEFAULT_EXCHANGE_RATES.lak_to_thb);
        if (displayCurrency === '$') return Math.round(lakValue * DEFAULT_EXCHANGE_RATES.lak_to_usd);
        return Math.round(lakValue);
      };
      const body: {
        startIndex?: number;
        endIndex?: number;
        province?: string;
        minPriceKip?: number;
        maxPriceKip?: number;
        minPriceDisplay?: number;
        maxPriceDisplay?: number;
        displayCurrency?: CurrencySymbol;
        priceSortOrder?: HomePriceSortOrder;
        latestPostFirst?: boolean;
        activeProfileId?: string;
        authUserId?: string;
        cursorId?: string;
        cursorBoosted?: boolean;
        cursorCreatedAt?: string;
        pageSize?: number;
        feedSeed?: string;
        guestToken?: string;
        excludePostIds?: string[];
      } = {};
      if (province && province.trim() !== '') body.province = province.trim();
      if (minPriceKip != null) body.minPriceKip = minPriceKip;
      if (maxPriceKip != null) body.maxPriceKip = maxPriceKip;
      if (minPriceKip != null) body.minPriceDisplay = toDisplayPriceValue(minPriceKip);
      if (maxPriceKip != null) body.maxPriceDisplay = toDisplayPriceValue(maxPriceKip);
      if (minPriceKip != null || maxPriceKip != null || hasPriceSort) {
        body.displayCurrency = displayCurrency;
      }
      if (hasPriceSort) body.priceSortOrder = priceSortOrder;
      if (feedSeedRef.current) body.feedSeed = feedSeedRef.current;
      // ส่ง user id/profie id เสมอ เพื่อให้ backend จัด boost owner ให้ถูกต้อง
      if (typeof activeProfileId === 'string' && activeProfileId.trim()) {
        body.activeProfileId = activeProfileId.trim();
      }
      if (typeof authUserId === 'string' && authUserId.trim()) {
        body.authUserId = authUserId.trim();
      }

      let guestTokenForActor: string | null = null;
      const userIdForActor = typeof activeProfileId === 'string' && activeProfileId.trim()
        ? activeProfileId.trim()
        : typeof authUserId === 'string' && authUserId.trim()
          ? authUserId.trim()
          : typeof (currentSession as { user?: { id?: string } } | undefined)?.user?.id === 'string'
            ? (currentSession as { user?: { id?: string } }).user?.id || null
            : null;

      // Send guest token so the server can personalise the feed for guests.
      // (Logged-in userId is derived server-side from the session cookie.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(currentSession as any)?.user?.id) {
        try {
          const token = getPrimaryGuestToken();
          if (token && typeof token === 'string' && token !== 'null') {
            body.guestToken = token;
            guestTokenForActor = token;
          }
        } catch {
          // ignore
        }
      }

      const actorKey = resolveHomeFeedActorKey(userIdForActor, guestTokenForActor);
      // Price-filtered/sorted feeds should not exclude previously seen IDs,
      // otherwise narrow ranges can intermittently return empty results.
      if (actorKey && !hasPriceFilter && !hasPriceSort) {
        const excludePostIds = readHomeFeedSeenPostIds(province, actorKey);
        if (excludePostIds.length > 0) {
          body.excludePostIds = excludePostIds;
        }
      }

      // โหลดเพิ่ม: ใช้ cursor แทน offset เพื่อให้เร็วเท่ากันไม่ว่าเลื่อนลึกแค่ไหน
      // backend จะ merge cache + boost สด และจัดเรียง owner boost ให้อัตโนมัติ
      const useCursorPagination = !isInitial && !hasPriceFilter && !hasPriceSort;
      const cursor = useCursorPagination ? lastPostRef.current : null;
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

      const isWithinClientPriceFilter = (post: HomeFeedPost) => {
        // Server already applies price filter/sort; avoid client-side double filtering.
        if (hasPriceFilter || hasPriceSort) return true;

        if (!hasPriceFilter) return true;

        const approxLak = Number((post as { approx_price_lak?: unknown }).approx_price_lak);
        if (Number.isFinite(approxLak) && approxLak > 0) {
          if (minPriceKip != null && approxLak < minPriceKip) return false;
          if (maxPriceKip != null && approxLak > maxPriceKip) return false;
          return true;
        }

        const displayLak = typeof (post as { display_price?: unknown }).display_price === 'number'
          ? ((post as { display_price?: number }).display_price ?? null)
          : null;

        let lakPrice: number | null = displayLak;
        if (lakPrice == null) {
          lakPrice = toLakPrice(
            (post as { price?: number | string | null }).price,
            (post as { price_currency?: string | null }).price_currency,
            clientExchangeRates,
          );
        }

        if (lakPrice == null) return true;
        if (minPriceKip != null && lakPrice < minPriceKip) return false;
        if (maxPriceKip != null && lakPrice > maxPriceKip) return false;
        return true;
      };
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
        ordered = hydratedPosts.filter((post) => !post.is_hidden);
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
        // When price filter/sort is active, avoid local just-post injection
        // because it can introduce out-of-range posts into filtered results.
        if (!hasPriceFilter && !hasPriceSort) {
          try {
            const justPostedPost = readJustPostedRecommendPost();
            if (justPostedPost) {
              initialList = mergeJustPostedPost(ordered, justPostedPost);
            }
            clearHomeFeedStorage();
          } catch {
            // ignore
          }
        }
        const filteredInitialList = initialList.filter(isWithinClientPriceFilter);
        setPosts(filteredInitialList);
        preloadPostsVisibleImages(filteredInitialList, 2);
        fireInitialLoadDone();
        markHomeMotionEvent('initial-feed-ready', {
          postCount: filteredInitialList.length,
          backgroundRefresh,
        });
        try {
          if (shouldPersistHomeFeedCache) {
            writeHomeFeedCache(province, filteredInitialList, nextHasMore);
          }
        } catch {
          // ignore
        }
      } else {
        setPosts((prev) => {
          const ids = new Set(prev.map((post) => String(post.id)));
          const newOnes = ordered
            .filter(isWithinClientPriceFilter)
            .filter((post) => !ids.has(String(post.id)));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        });
        recordHomeMotionDuration('feed-hydrate', 'append-feed-posts', 0, {
          appendedCount: ordered.length,
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        if (isInitial) {
          fireInitialLoadDone();
        }
        return;
      }

      if (isInitial) {
        // ถ้า initial fetch ล้มเหลว อย่าให้หน้า Home ค้าง skeleton ตลอด
        setPosts([]);
        setHasMore(false);
        fireInitialLoadDone();
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('useHomeFeed fetchPosts failed:', e);
      }
      return;
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
  }, [page, loadingMore, province, minPriceKip, maxPriceKip, priceSortOrder, hasPriceSort, hasPriceFilter, clientExchangeRates, fireInitialLoadDone]);
  const fetchPostsRef = useRef(fetchPosts);
  useEffect(() => { fetchPostsRef.current = fetchPosts; }, [fetchPosts]);
  const initialLoadFromCacheRef = useRef(false);

  // ดึงโพสต์จาก cache แล้ว random ใหม่ทุกครั้งที่ refresh
  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    // ดึงโพสต์จาก cache
    if (hasPriceFilter || hasPriceSort) {
      await fetchPosts(true);
      return;
    }

    const { fromCache, initialPosts, hasMore: initialHasMore } = prepareInitialHomeFeedState(province);
    // หา actorKey ปัจจุบัน
    let userId: string | null = null;
    if (typeof activeProfileId === 'string' && activeProfileId.trim()) {
      userId = activeProfileId.trim();
    } else if (typeof authUserId === 'string' && authUserId.trim()) {
      userId = authUserId.trim();
    } else if (currentSessionUserId) {
      userId = currentSessionUserId;
    }
    const actorKey = resolveHomeFeedActorKey(
      userId,
      userId ? null : (typeof window !== 'undefined' ? getPrimaryGuestToken() : null),
    );

    if (fromCache && Array.isArray(initialPosts) && initialPosts.length > 0 && actorKey) {
      // 1. filter seen ก่อน
      const seenIds = readHomeFeedSeenPostIds(province, actorKey);
      const filtered = initialPosts.filter(post => post.id && !seenIds.includes(String(post.id)));
      // 2. ถ้าเหลือ < 10 ให้ fetch จาก server ทันที
      if (filtered.length < 10) {
        // fetch จาก server
        forceNewSeedOnNextInitialFetchRef.current = true;
        feedSeedRef.current = null;
        try {
          clearHomeFeedStorage({ clearCache: true });
        } catch {}
        await fetchPosts(true);
        // fallback: ถ้า fetch แล้วยังได้น้อย ให้ clear seen-list แล้ว random ใหม่
        // (ต้องอ่าน cache ใหม่หลัง fetch)
        const { fromCache: fc2, initialPosts: ip2 } = prepareInitialHomeFeedState(province);
        if (fc2 && Array.isArray(ip2) && ip2.length > 0) {
          try {
            window.localStorage.removeItem(
              `home_feed_seen:${(province || '').trim() || 'all'}:${actorKey}`
            );
          } catch {}
          const shuffled2 = [...ip2];
          for (let i = shuffled2.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled2[i], shuffled2[j]] = [shuffled2[j], shuffled2[i]];
          }
          setPosts(shuffled2);
          setHasMore(true);
          // mark seen ใหม่
          markHomeFeedSeenPostIds(province, actorKey, shuffled2.map(p => String(p.id)));
        }
        return;
      }
      // 3. random (shuffle)
      const shuffled = [...filtered];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setPosts(shuffled);
      setHasMore(initialHasMore);
      // 4. mark seen กับโพสต์ที่แสดงผลทันที
      markHomeFeedSeenPostIds(province, actorKey, shuffled.map(p => String(p.id)));
    } else {
      // ถ้าไม่มี cache ให้ fetch ใหม่จาก server
      forceNewSeedOnNextInitialFetchRef.current = true;
      feedSeedRef.current = null;
      try {
        clearHomeFeedStorage({ clearCache: true });
      } catch {}
      await fetchPosts(true);
    }
  }, [fetchPosts, hasPriceFilter, hasPriceSort, province, activeProfileId, authUserId, currentSession]);

  useEffect(() => {
    const currentUserId =
      typeof activeProfileId === 'string' && activeProfileId.trim()
        ? activeProfileId.trim()
        : typeof authUserId === 'string' && authUserId.trim()
          ? authUserId.trim()
          : currentSessionUserId
            ? currentSessionUserId
            : null;

    const currentActorKey = resolveHomeFeedActorKey(
      currentUserId,
      currentUserId ? null : (typeof window !== 'undefined' ? getPrimaryGuestToken() : null),
    );

    if (!currentActorKey) return;

    const previousActorKey = lastResolvedActorKeyRef.current;
    if (!previousActorKey) {
      lastResolvedActorKeyRef.current = currentActorKey;
      return;
    }

    if (previousActorKey !== currentActorKey) {
      if (previousActorKey.startsWith('guest:') && currentActorKey.startsWith('user:')) {
        migrateHomeFeedSeenPostIds(province, previousActorKey, currentActorKey);
      }
      lastResolvedActorKeyRef.current = currentActorKey;
      void refreshData();
    }
  }, [activeProfileId, authUserId, currentSessionUserId, province, minPriceKip, maxPriceKip, priceSortOrder, refreshData]);

  useEffect(() => {
    initialLoadFromCacheRef.current = false;
    feedSeedRef.current = null;
    const shouldBypassCachedFeed = isBrowserReloadNavigation();
    if (shouldBypassCachedFeed) {
      forceNewSeedOnNextInitialFetchRef.current = true;
    }

    if (hasPriceFilter || hasPriceSort) {
      try {
        clearHomeFeedStorage({ clearCache: true });
      } catch {
        // ignore
      }
      setPosts([]);
      setLoadingMore(true);
      setHasMore(true);
      setPage(0);
      fetchPostsRef.current(true);
      return;
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
  }, [province, minPriceKip, maxPriceKip, priceSortOrder, hasPriceFilter, hasPriceSort, fireInitialLoadDone]);

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
