'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

export interface SearchLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface UseSearchPostsOptions {
  query: string;
  province?: string;
  session?: any;
  sessionReady?: boolean;
  /** ถ้ามี = ใช้ liked/saved นี้แทนโหลดเอง (ลด request ซ้ำในหน้าโฮม) */
  sharedLikedSaved?: SearchLikedSavedShared | null;
  /** เมื่อ false = ไม่ยิง search API และไม่รัน effect (ใช้เมื่อยังไม่มีคำค้น เพื่อลดงานตอนโหลดหน้าโฮม) */
  enabled?: boolean;
}

interface UseSearchPostsReturn {
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchSearch: () => Promise<void>;
}

export function useSearchPosts(options: UseSearchPostsOptions): UseSearchPostsReturn {
  const { query, province, session, sessionReady = true, sharedLikedSaved, enabled = true } = options;
  const [posts, setPosts] = useState<any[]>([]);
  const q = (query || '').trim();
  const shouldLoad = enabled && q.length > 0;
  const [loading, setLoading] = useState(() => shouldLoad);
  const [currentSession, setCurrentSession] = useState<any>(sessionReady ? session : undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const likedPostsOut = sharedLikedSaved ? sharedLikedSaved.likedPosts : likedPosts;
  const savedPostsOut = sharedLikedSaved ? sharedLikedSaved.savedPosts : savedPosts;
  const setLikedPostsOut = sharedLikedSaved ? sharedLikedSaved.setLikedPosts : setLikedPosts;
  const setSavedPostsOut = sharedLikedSaved ? sharedLikedSaved.setSavedPosts : setSavedPosts;
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
    setCurrentSession(sessionReady ? session : undefined);
  }, [session, sessionReady]);

  useEffect(() => {
    if (sharedLikedSaved) return;
    if (!sessionReady || currentSession === undefined) return;
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

  const fetchSearch = useCallback(async () => {
    const q = (query || '').trim();
    if (q.length === 0) {
      setPosts([]);
      return;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      if (province && province.trim() !== '') params.set('province', province.trim());
      const res = await fetch(`/api/posts/search?${params.toString()}`, { signal });
      if (cancelledRef.current) return;
      const data = await res.json().catch(() => ({}));
      if (cancelledRef.current) return;
      const list = Array.isArray(data.posts) ? data.posts : [];
      setPosts(list);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      throw e;
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [query, province]);

  useEffect(() => {
    if (!enabled) {
      setPosts([]);
      return;
    }
    const q = (query || '').trim();
    if (q.length === 0) {
      setPosts([]);
      return;
    }
    setLoading(true);
    fetchSearch();
  }, [enabled, query, province, fetchSearch]);

  return {
    posts,
    setPosts,
    loading,
    session: currentSession,
    likedPosts: likedPostsOut,
    savedPosts: savedPostsOut,
    setLikedPosts: setLikedPostsOut,
    setSavedPosts: setSavedPostsOut,
    fetchSearch,
  };
}
