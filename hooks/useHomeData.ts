'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { safeParseJSON } from '@/utils/storageUtils';

interface UseHomeDataReturn {
  // State
  posts: any[];
  session: any;
  userProfile: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  myGuestPosts: { post_id: string; token: string }[];
  
  // Setters
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  setPage: (page: number | ((prev: number) => number)) => void;
  setHasMore: (hasMore: boolean) => void;
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  
  // Functions
  fetchPosts: (isInitial?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

const PAGE_SIZE = 12;
const PREFETCH_COUNT = 10;

export function useHomeData(searchTerm: string): UseHomeDataReturn {
  const [posts, setPosts] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myGuestPosts, setMyGuestPosts] = useState<{ post_id: string; token: string }[]>([]);
  
  // Use refs to avoid recreating fetchPosts function
  const pageRef = useRef(page);
  const loadingMoreRef = useRef(loadingMore);
  
  // Keep refs in sync with state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const updateLastSeen = useCallback(async (idOrToken: string) => {
    if (!idOrToken) return;
    await supabase
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', idOrToken);
  }, []);

  const fetchUserProfile = useCallback(async (userId: string) => {
    // Optimize: Select เฉพาะ fields ที่จำเป็น
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, phone, last_seen')
      .eq('id', userId)
      .single();
    if (data) setUserProfile(data);
  }, []);

  const fetchSavedStatus = useCallback(async (userIdOrToken: string, currentSession: any) => {
    const table = currentSession ? 'post_saves' : 'post_saves_guest';
    const column = currentSession ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const savedMap: { [key: string]: boolean } = {};
      data.forEach(item => savedMap[item.post_id] = true);
      setSavedPosts(savedMap);
    }
  }, []);

  const fetchLikedStatus = useCallback(async (userIdOrToken: string, currentSession: any) => {
    const table = currentSession ? 'post_likes' : 'post_likes_guest';
    const column = currentSession ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const likedMap: { [key: string]: boolean } = {};
      data.forEach(item => likedMap[item.post_id] = true);
      setLikedPosts(likedMap);
    }
  }, []);

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (loadingMoreRef.current) return;
    setLoadingMore(true);
    const currentPage = isInitial ? 0 : pageRef.current;
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = startIndex + PREFETCH_COUNT - 1;

    let postIds: string[] = [];

    // ดึงข้อมูลเฉพาะสถานะ recommend เท่านั้น
    const { data, error } = await supabase
      .from('cars')
      .select('id')
      .eq('status', 'recommend')
      .eq('is_hidden', false)
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startIndex, endIndex);

    if (!error && data) {
      postIds = data.map(p => p.id);
    }

    setHasMore(postIds.length === PREFETCH_COUNT);

    if (isInitial) {
      setPosts([]);
    }

    // Batch loading: ดึง posts ทั้งหมดในครั้งเดียวแทนการ loop
    // Optimize: Select เฉพาะ fields ที่จำเป็นเท่านั้น
    if (postIds.length > 0) {
      const { data: postsData, error: postsError } = await supabase
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', postIds)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = postsData.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    }
    setLoadingMore(false);
  }, []); // Empty dependency array - using refs instead

  const handleActiveStatus = useCallback(async (currentSession: any) => {
    if (currentSession) {
      await updateLastSeen(currentSession.user.id);
      fetchUserProfile(currentSession.user.id);
      fetchSavedStatus(currentSession.user.id, currentSession);
      fetchLikedStatus(currentSession.user.id, currentSession);
    } else {
      const token = getPrimaryGuestToken();
      await updateLastSeen(token);
      setUserProfile(null);
      fetchSavedStatus(token, null);
      fetchLikedStatus(token, null);
      const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
      if (stored.length > 0) {
        const uniqueTokens = Array.from(new Set(stored.map((p: any) => p.token).filter(Boolean)));
        for (const t of uniqueTokens) {
          if (typeof t === 'string' && t !== token) await updateLastSeen(t);
        }
      }
    }
  }, [updateLastSeen, fetchUserProfile, fetchSavedStatus, fetchLikedStatus]);

  // Initialize session and fetch data
  useEffect(() => {
    const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
    setMyGuestPosts(stored);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      handleActiveStatus(session);
    }).catch((error) => {
      console.error('Error getting session:', error);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      handleActiveStatus(session);
    });

    const interval = setInterval(() => {
      const latestStored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const currentSession = sessionData?.session;
        if (currentSession) {
          updateLastSeen(currentSession.user.id);
        } else {
          const token = getPrimaryGuestToken();
          updateLastSeen(token);
          const uniqueTokens = Array.from(new Set(latestStored.map((p: any) => p.token).filter(Boolean)));
          uniqueTokens.forEach(t => {
            if (typeof t === 'string' && t !== token) updateLastSeen(t);
          });
        }
      }).catch((error) => {
        console.error('Error getting session in interval:', error);
      });
    }, 120000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [handleActiveStatus, updateLastSeen]);

  // Fetch posts when search term changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(true);
    if (searchTerm) {
      localStorage.setItem('last_searched_province', searchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]); // Only depend on searchTerm

  // Fetch posts when page changes
  useEffect(() => {
    if (page > 0) {
      fetchPosts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]); // Only depend on page

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
    if (session) {
      await handleActiveStatus(session);
    }
  }, [fetchPosts, handleActiveStatus, session]);

  return {
    // State
    posts,
    session,
    userProfile,
    likedPosts,
    savedPosts,
    page,
    hasMore,
    loadingMore,
    myGuestPosts,
    
    // Setters
    setPosts,
    setPage,
    setHasMore,
    setLikedPosts,
    setSavedPosts,
    
    // Functions
    fetchPosts,
    refreshData,
  };
}
