'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FEED_PAGE_SIZE } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';

interface UseHomeFeedOptions {
  session?: any;
  /** แขวงที่เลือกจากฟิลเตอร์หน้า Home — ว่าง = แสดงทุกแขวง */
  province?: string;
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
  const { session, province } = options;
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(session ?? undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (session === undefined) {
      supabase.auth.getSession().then(({ data: { session: s } }) => setCurrentSession(s));
    } else {
      setCurrentSession(session);
    }
  }, [session]);

  useEffect(() => {
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
  }, [currentSession]);

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number) => {
    if (currentSession === undefined) return;
    if (loadingMore && !isInitial) return;
    const currentFetchId = ++fetchIdRef.current;
    setLoadingMore(true);
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : page);
    const rangeStart = currentPage * FEED_PAGE_SIZE;
    const rangeEnd = rangeStart + FEED_PAGE_SIZE - 1;

    try {
      const url = '/api/posts/feed';
      const body: { startIndex: number; endIndex: number; province?: string } = { startIndex: rangeStart, endIndex: rangeEnd };
      if (province && province.trim() !== '') body.province = province.trim();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      const postIds: string[] = Array.isArray(data.postIds) ? data.postIds : [];
      const nextHasMore = !!data.hasMore;

      if (currentFetchId !== fetchIdRef.current) return;
      setHasMore(nextHasMore);

      if (postIds.length === 0) {
        if (isInitial) setPosts([]);
        setLoadingMore(false);
        return;
      }

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
      const ordered = (postsData || []).filter((p: any) => p.status === 'recommend' && !p.is_hidden);
      ordered.sort((a: any, b: any) => {
        const ai = order.get(String(a.id)) ?? 1e9;
        const bi = order.get(String(b.id)) ?? 1e9;
        return ai - bi;
      });

      if (isInitial) {
        setPosts(ordered);
      } else {
        setPosts(prev => {
          const ids = new Set(prev.map(p => p.id));
          const newOnes = ordered.filter((p: any) => !ids.has(p.id));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        });
      }
    } finally {
      if (fetchIdRef.current === currentFetchId) setLoadingMore(false);
    }
  }, [currentSession, page, loadingMore, province]);
  const fetchPostsRef = useRef(fetchPosts);
  useEffect(() => { fetchPostsRef.current = fetchPosts; }, [fetchPosts]);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
  }, [fetchPosts]);

  useEffect(() => {
    if (currentSession === undefined) return;
    setPage(0);
    setHasMore(true);
    fetchPosts(true);
  }, [currentSession, province]);

  const lastFetchedPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (page === 0 || loadingMore || currentSession === undefined) return;
    if (lastFetchedPageRef.current === page) return;
    lastFetchedPageRef.current = page;
    fetchPostsRef.current(false, page);
  }, [page, currentSession, loadingMore]);
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
