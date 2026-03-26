'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HOME_FEED_PAGE_SIZE, FEED_CACHE_MAX_AGE_MS } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { preloadPostsVisibleImages } from '@/utils/imagePreload';
import {
  endHomeMotionTimer,
  markHomeMotionEvent,
  recordHomeMotionDuration,
  startHomeMotionTimer,
} from '@/lib/homeMotionProfiler';

const FEED_CACHE_KEY = 'home_feed_cache';

/** อ่านรายการโพสจาก storage ตั้งแต่ state ครั้งแรก — ให้เฟรมแรกเห็นโพสที่พึ่งโพสพร้อมรูปทันที (แทบไม่เห็น Skeleton) */
function getInitialPostsFromStorage(province?: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('just_posted_post');
    const justPostedPost = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
    if (!justPostedPost || justPostedPost.status !== 'recommend' || justPostedPost.is_hidden) {
      const cacheRaw = window.localStorage.getItem(FEED_CACHE_KEY);
      if (cacheRaw) {
        const parsed = JSON.parse(cacheRaw);
        if (parsed?.province === province && Array.isArray(parsed.posts)) {
          const age = Date.now() - (parsed.ts || 0);
          if (age < FEED_CACHE_MAX_AGE_MS) {
            return parsed.posts.slice(0, HOME_FEED_PAGE_SIZE);
          }
        }
      }
      return [];
    }
    const preloadRaw = sessionStorage.getItem('just_posted_post_preload');
    const preloadArr = preloadRaw ? (() => { try { const a = JSON.parse(preloadRaw); return Array.isArray(a) ? a : null; } catch { return null; } })() : null;
    if (preloadArr && Array.isArray(justPostedPost.images) && preloadArr.length === justPostedPost.images.length) {
      justPostedPost._preloadImages = preloadArr;
    }
    const cacheRaw = window.localStorage.getItem(FEED_CACHE_KEY);
    if (cacheRaw) {
      const parsed = JSON.parse(cacheRaw);
        if (parsed?.province === province && Array.isArray(parsed.posts)) {
          const age = Date.now() - (parsed.ts || 0);
          if (age < FEED_CACHE_MAX_AGE_MS) {
            const cachedPosts = parsed.posts.slice(0, HOME_FEED_PAGE_SIZE);
            const rest = cachedPosts.filter((p: any) => String(p.id) !== String(justPostedPost.id));
          return [justPostedPost, ...rest];
        }
      }
    }
    return [justPostedPost];
  } catch {
    return [];
  }
}

export interface HomeLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface UseHomeFeedOptions {
  session?: any;
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
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  hasMore: boolean;
  setHasMore: (v: boolean) => void;
  loadingMore: boolean;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useHomeFeed(options: UseHomeFeedOptions): UseHomeFeedReturn {
  const { session, sessionReady = true, province, onInitialLoadDone, sharedLikedSaved, isActive = true } = options;
  const [posts, setPosts] = useState<any[]>(() => getInitialPostsFromStorage(province));
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(session ?? undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
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
  const lastPostRef = useRef<{ is_boosted: boolean; created_at: string } | null>(null);
  if (posts.length > 0) {
    const last = posts[posts.length - 1];
    if (last && typeof last.is_boosted === 'boolean' && typeof last.created_at === 'string') {
      lastPostRef.current = { is_boosted: last.is_boosted, created_at: last.created_at };
    }
  }

  const fireInitialLoadDone = useCallback(() => {
    if (initialLoadDoneFiredRef.current) return;
    initialLoadDoneFiredRef.current = true;
    onInitialLoadDone?.();
  }, [onInitialLoadDone]);

  useEffect(() => {
    setCurrentSession(session ?? undefined);
  }, [session]);

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
      } catch (_) {}
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
    const pageSize = HOME_FEED_PAGE_SIZE;
    const rangeEnd = rangeStart + pageSize - 1;

    try {
      const url = '/api/posts/feed';
      const body: {
        startIndex?: number;
        endIndex?: number;
        province?: string;
        cursorBoosted?: boolean;
        cursorCreatedAt?: string;
        pageSize?: number;
      } = {};
      if (province && province.trim() !== '') body.province = province.trim();

      // โหลดเพิ่ม: ใช้ cursor แทน offset เพื่อให้เร็วเท่ากันไม่ว่าเลื่อนลึกแค่ไหน
      const cursor = !isInitial ? lastPostRef.current : null;
      if (cursor) {
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
      const postIds: string[] = Array.isArray(data.postIds) ? data.postIds : [];
      // ได้ครบหนึ่งหน้า = มีหน้าถัดไป; ได้น้อยกว่าแต่ยังมีรายการ = โหลดต่อ (กรณี backend limit) ไม่หยุดก่อนถึงจริง
      const fullPage = !isInitial && postIds.length >= pageSize;
      const partialPage = !isInitial && postIds.length > 0 && postIds.length < pageSize;
      const nextHasMore = !!data.hasMore || fullPage || partialPage;
      const apiPosts: any[] = Array.isArray(data.posts) ? data.posts : [];

      setHasMore(nextHasMore);

      if (postIds.length === 0) {
        if (isInitial) {
          setPosts([]);
          fireInitialLoadDone();
        }
        return;
      }

      let ordered: any[];
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
        ordered = (postsData || []).filter((p: any) => p.status === 'recommend' && !p.is_hidden);
        ordered.sort((a: any, b: any) => {
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
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('just_posted_post');
            const justPost = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
            if (justPost && justPost.status === 'recommend' && !justPost.is_hidden) {
              const preloadRaw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('just_posted_post_preload') : null;
              const preloadArr = preloadRaw ? (() => { try { const a = JSON.parse(preloadRaw); return Array.isArray(a) ? a : null; } catch { return null; } })() : null;
              if (preloadArr && Array.isArray(justPost.images) && preloadArr.length === justPost.images.length) {
                justPost._preloadImages = preloadArr;
              }
              const rest = ordered.filter((p: any) => String(p.id) !== String(justPost.id));
              initialList = [justPost, ...rest];
            }
            window.localStorage.removeItem('just_posted_post');
            window.localStorage.removeItem('just_posted_post_id');
            try { sessionStorage.removeItem('just_posted_post_preload'); } catch { /* ignore */ }
          } catch {
            // ignore
          }
        }
        setPosts(initialList);
        preloadPostsVisibleImages(initialList, 2);
        fireInitialLoadDone();
        markHomeMotionEvent('initial-feed-ready', {
          postCount: initialList.length,
          backgroundRefresh,
        });
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
              province,
              posts: ordered,
              hasMore: nextHasMore,
              ts: Date.now(),
            }));
          }
        } catch {
          // ignore
        }
      } else {
        setPosts(prev => {
          const ids = new Set(prev.map(p => String(p.id)));
          const newOnes = ordered.filter((p: any) => !ids.has(String(p.id)));
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
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('just_posted_post');
        window.localStorage.removeItem('just_posted_post_id');
        window.localStorage.removeItem(FEED_CACHE_KEY);
        try { sessionStorage.removeItem('just_posted_post_preload'); } catch { /* ignore */ }
      }
    } catch {
      // ignore
    }
    await fetchPosts(true);
  }, [fetchPosts]);

  useEffect(() => {
    initialLoadFromCacheRef.current = false;
    let fromCache = false;
    // อ่านโพสที่พึ่งโพสกับแคชพร้อมกัน แล้ว set รายการครั้งเดียว เพื่อไม่ให้จอกระพริบ
    let justPostedPost: any = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('just_posted_post');
        justPostedPost = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
        if (!justPostedPost || justPostedPost.status !== 'recommend' || justPostedPost.is_hidden) justPostedPost = null;
        else {
          const preloadRaw = sessionStorage.getItem('just_posted_post_preload');
          const preloadArr = preloadRaw ? (() => { try { const a = JSON.parse(preloadRaw); return Array.isArray(a) ? a : null; } catch { return null; } })() : null;
          if (preloadArr && Array.isArray(justPostedPost.images) && preloadArr.length === justPostedPost.images.length) {
            justPostedPost._preloadImages = preloadArr;
          }
        }
      } catch {
        justPostedPost = null;
      }
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(FEED_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.province === province && Array.isArray(parsed.posts)) {
            const age = Date.now() - (parsed.ts || 0);
            if (age < FEED_CACHE_MAX_AGE_MS) {
              const cachedPosts = parsed.posts.slice(0, HOME_FEED_PAGE_SIZE);
              const initialPosts = justPostedPost
                ? [justPostedPost, ...cachedPosts.filter((p: any) => String(p.id) !== String(justPostedPost.id))]
                : cachedPosts;
              setPosts(initialPosts);
              setLoadingMore(false);
              preloadPostsVisibleImages(initialPosts, 2);
              setHasMore(!!parsed.hasMore);
              initialLoadFromCacheRef.current = true;
              fromCache = true;
              if (onInitialLoadDone && !initialLoadDoneFiredRef.current) {
                initialLoadDoneFiredRef.current = true;
                onInitialLoadDone();
              }
              recordHomeMotionDuration('feed-cache', 'initial-feed-cache-hit', 0, {
                cachedPosts: initialPosts.length,
                province: province ?? '',
              });
              // ยังไม่ลบ just_posted_post ที่นี่ — รอให้ fetch ในพื้นหลังเสร็จแล้วเอาโพสนั้นไปไว้บนสุดก่อน ค่อยลบใน fetchPosts
            }
          }
        }
      }
    } catch {
      // ignore
    }
    if (!fromCache) {
      const initialPosts = justPostedPost ? [justPostedPost] : [];
      setPosts(initialPosts);
      setLoadingMore(!justPostedPost);
      setHasMore(true);
      recordHomeMotionDuration('feed-cache', 'initial-feed-cache-miss', 0, {
        initialPosts: initialPosts.length,
        province: province ?? '',
      });
      if (justPostedPost && onInitialLoadDone && !initialLoadDoneFiredRef.current) {
        initialLoadDoneFiredRef.current = true;
        onInitialLoadDone();
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
  }, [province]);

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
