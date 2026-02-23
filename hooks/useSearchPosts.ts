'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

interface UseSearchPostsOptions {
  query: string;
  province?: string;
  session?: any;
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
  const { query, province, session } = options;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(session ?? undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});

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

  const fetchSearch = useCallback(async () => {
    if (currentSession === undefined) return;
    const q = (query || '').trim();
    if (q.length === 0) {
      setPosts([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      if (province && province.trim() !== '') params.set('province', province.trim());
      const res = await fetch(`/api/posts/search?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.posts) ? data.posts : [];
      setPosts(list);
    } finally {
      setLoading(false);
    }
  }, [currentSession, query, province]);

  useEffect(() => {
    if (currentSession === undefined) return;
    const q = (query || '').trim();
    if (q.length === 0) {
      setPosts([]);
      return;
    }
    fetchSearch();
  }, [query, currentSession, province, fetchSearch]);

  return {
    posts,
    setPosts,
    loading,
    session: currentSession,
    likedPosts,
    savedPosts,
    setLikedPosts,
    setSavedPosts,
    fetchSearch,
  };
}
