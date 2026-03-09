'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FEED_PAGE_SIZE, INITIAL_FEED_PAGE_SIZE, FEED_CACHE_MAX_AGE_MS } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { preloadPostImages } from '@/utils/imagePreload';

const FEED_CACHE_KEY = 'home_feed_cache';

interface UseHomeFeedOptions {
  session?: any;
  /** เมื่อ true = รู้แล้วว่าใครล็อกอิน/เกสต์ แล้วค่อยโหลดไลก์/เซฟ */
  sessionReady?: boolean;
  /** แขวงที่เลือกจากฟิลเตอร์หน้า Home — ว่าง = แสดงทุกแขวง */
  province?: string;
  /** เรียกครั้งเดียวเมื่อโหลดโพสต์ชุดแรกเสร็จ (จาก cache หรือ API) */
  onInitialLoadDone?: () => void;
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
  const { session, sessionReady = true, province, onInitialLoadDone } = options;
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(session ?? undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const fetchIdRef = useRef(0);
  const initialLoadDoneFiredRef = useRef(false);
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
    Promise.all([
      supabase.from(likesTable).select('post_id').eq(likesColumn, idOrToken),
      supabase.from(savesTable).select('post_id').eq(savesColumn, idOrToken),
    ]).then(([likedRes, savedRes]) => {
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
  }, [sessionReady, currentSession]);

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number, backgroundRefresh = false) => {
    if (loadingMore && !isInitial) return;
    const currentFetchId = ++fetchIdRef.current;
    if (!(isInitial && backgroundRefresh)) setLoadingMore(true);
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : page);
    // โหลดเพิ่มใช้ offset จากจำนวนโพสต์จริง (ไม่ใช้ page) เพื่อไม่ข้ามรายการเมื่อ backend คืนน้อยกว่าที่ขอ
    const rangeStart = currentPage === 0 ? 0 : postsLengthRef.current;
    const pageSize = currentPage === 0 ? INITIAL_FEED_PAGE_SIZE : FEED_PAGE_SIZE;
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
      });
      const data = await res.json().catch(() => ({}));
      const postIds: string[] = Array.isArray(data.postIds) ? data.postIds : [];
      // ได้ครบหนึ่งหน้า = มีหน้าถัดไป; ได้น้อยกว่าแต่ยังมีรายการ = โหลดต่อ (กรณี backend limit) ไม่หยุดก่อนถึงจริง
      const fullPage = !isInitial && postIds.length >= pageSize;
      const partialPage = !isInitial && postIds.length > 0 && postIds.length < pageSize;
      const nextHasMore = !!data.hasMore || fullPage || partialPage;
      const apiPosts: any[] = Array.isArray(data.posts) ? data.posts : [];

      if (currentFetchId !== fetchIdRef.current) return;
      setHasMore(nextHasMore);

      if (postIds.length === 0) {
        if (isInitial) {
          setPosts([]);
          fireInitialLoadDone();
        }
        setLoadingMore(false);
        return;
      }

      let ordered: any[];
      if (apiPosts.length > 0) {
        ordered = apiPosts;
      } else {
        const { data: postsData, error } = await supabase
          .from('cars')
          .select(POST_WITH_PROFILE_SELECT)
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (currentFetchId !== fetchIdRef.current) return;
        if (error) {
          setLoadingMore(false);
          return;
        }
        const order = new Map(postIds.map((id, i) => [String(id), i]));
        ordered = (postsData || []).filter((p: any) => p.status === 'recommend' && !p.is_hidden);
        ordered.sort((a: any, b: any) => {
          const ai = order.get(String(a.id)) ?? 1e9;
          const bi = order.get(String(b.id)) ?? 1e9;
          return ai - bi;
        });
      }

      if (isInitial) {
        setPosts(ordered);
        // โหลดรูปล่วงหน้าชุดแรก (โพสที่เห็นบนจอ + ล่วงหน้า 2–3 โพส) ให้รู้สึกสมูทแบบ Facebook
        preloadPostImages(ordered, 5);
        fireInitialLoadDone();
        // หลังผู้ใช้โพสต์: แปะโพสต์ของตัวเองบนสุดของ feed (เหนือ Ad / รายการอื่น) จนกว่าจะ refresh
        const justPostedId =
          typeof window !== 'undefined' ? window.localStorage.getItem('just_posted_post_id') : null;
        if (justPostedId && justPostedId.trim() !== '') {
          const { data: justPost } = await supabase
            .from('cars')
            .select(POST_WITH_PROFILE_SELECT)
            .eq('id', justPostedId.trim())
            .maybeSingle();
          if (currentFetchId !== fetchIdRef.current) return;
          if (justPost && justPost.status === 'recommend' && !justPost.is_hidden) {
            const rest = ordered.filter((p: any) => String(p.id) !== String(justPostedId));
            setPosts([justPost, ...rest]);
          }
          try {
            window.localStorage.removeItem('just_posted_post_id');
          } catch {
            // ignore
          }
        }
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
      }
    } finally {
      if (fetchIdRef.current === currentFetchId) setLoadingMore(false);
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
        window.localStorage.removeItem('just_posted_post_id');
        window.localStorage.removeItem(FEED_CACHE_KEY);
      }
    } catch {
      // ignore
    }
    await fetchPosts(true);
  }, [fetchPosts]);

  useEffect(() => {
    initialLoadFromCacheRef.current = false;
    setPosts([]);
    setLoadingMore(true);
    let fromCache = false;
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(FEED_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.province === province && Array.isArray(parsed.posts)) {
            const age = Date.now() - (parsed.ts || 0);
            if (age < FEED_CACHE_MAX_AGE_MS) {
              const cachedPosts = parsed.posts.slice(0, INITIAL_FEED_PAGE_SIZE);
              setPosts(cachedPosts);
              setLoadingMore(false);
              // โหลดรูปล่วงหน้าแบบ Facebook — รูปพร้อมก่อนผู้ใช้เลื่อนเห็น
              preloadPostImages(cachedPosts, 5);
              setHasMore(!!parsed.hasMore);
              initialLoadFromCacheRef.current = true;
              fromCache = true;
              if (onInitialLoadDone && !initialLoadDoneFiredRef.current) {
                initialLoadDoneFiredRef.current = true;
                onInitialLoadDone();
              }
              // แสดงโพสที่เพิ่งโพสทันทีเมื่อกลับจาก create-post (ไม่ต้องรอ background fetch)
              const justPostedId = typeof window !== 'undefined' ? window.localStorage.getItem('just_posted_post_id') : null;
              if (justPostedId && justPostedId.trim() !== '') {
                supabase
                  .from('cars')
                  .select(POST_WITH_PROFILE_SELECT)
                  .eq('id', justPostedId.trim())
                  .maybeSingle()
                  .then(({ data: justPost }) => {
                    if (justPost && justPost.status === 'recommend' && !justPost.is_hidden) {
                      setPosts((prev) => {
                        const hasIt = prev.some((p: any) => String(p.id) === String(justPostedId));
                        if (hasIt) return prev;
                        return [justPost, ...prev];
                      });
                    }
                  });
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
    setPage(0);
    if (!fromCache) {
      setHasMore(true);
    }
    if (initialLoadFromCacheRef.current) {
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
    likedPosts,
    savedPosts,
    setLikedPosts,
    setSavedPosts,
    fetchPosts,
    refreshData,
  };
}
