'use client'

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';

export type PostListType = 'saved' | 'liked' | 'sold' | 'my-posts';

interface UsePostListDataOptions {
  type: PostListType;
  userIdOrToken?: string;
  session?: any;
  tab?: string;
  searchTerm?: string;
  status?: string; // สำหรับ sold page
}

interface UsePostListDataReturn {
  // State
  posts: any[];
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  
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

export function usePostListData(options: UsePostListDataOptions): UsePostListDataReturn {
  const { type, userIdOrToken, session, tab, searchTerm, status } = options;
  
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(session || null);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!session) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setCurrentSession(currentSession);
      } else {
        setCurrentSession(session);
      }
    };
    initSession();
  }, [session]);

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (loadingMore) return;
    setLoadingMore(true);
    
    const startIndex = isInitial ? 0 : page * PAGE_SIZE;
    const endIndex = startIndex + PREFETCH_COUNT - 1;
    const currentUserId = currentSession?.user?.id;

    try {
      let postIds: string[] = [];

      // ดึง post_ids ตาม type
      if (type === 'saved') {
        const idOrToken = userIdOrToken || currentUserId || getPrimaryGuestToken();
        const { data: savesData, error: savesError } = await supabase
          .from('post_saves')
          .select('post_id')
          .eq('user_id', idOrToken)
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
        
        if (savesError || !savesData) {
          setLoadingMore(false);
          return;
        }
        postIds = savesData.map(item => item.post_id);
      } else if (type === 'liked') {
        const { data: likesData, error: likesError } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userIdOrToken || currentUserId || '')
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
        
        if (likesError || !likesData) {
          setLoadingMore(false);
          return;
        }
        postIds = likesData.map(item => item.post_id);
      } else if (type === 'sold') {
        let query = supabase
          .from('cars')
          .select('id')
          .eq('status', status || 'sold')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
        
        if (searchTerm) {
          query = query.ilike('caption', `%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        if (error || !data) {
          setLoadingMore(false);
          return;
        }
        postIds = data.map(p => p.id);
      } else if (type === 'my-posts') {
        const { data: idsData, error: idsError } = await supabase
          .from('cars')
          .select('id')
          .eq('user_id', userIdOrToken || currentUserId || '')
          .eq('status', tab || 'recommend')
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
        
        if (idsError || !idsData) {
          setLoadingMore(false);
          return;
        }
        postIds = idsData.map(p => p.id);
      }

      setHasMore(postIds.length === PREFETCH_COUNT);

      // Reset posts if initial load
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
          .order('created_at', { ascending: false });

        if (!postsError && postsData) {
          // Filter logic for saved/liked pages
          const filteredPosts = postsData.filter(postData => {
            if (type === 'saved' || type === 'liked') {
              const isNotHidden = !postData.is_hidden;
              const isOwner = currentUserId && postData.user_id === currentUserId;
              const matchesTab = tab ? postData.status === tab : true;
              return matchesTab && (isNotHidden || isOwner);
            }
            return true;
          });

          // Add posts to state
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = filteredPosts.filter(p => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });

          // Update interaction status
          if (type === 'saved') {
            setSavedPosts(prev => {
              const updated = { ...prev };
              filteredPosts.forEach(p => updated[p.id] = true);
              return updated;
            });
          } else if (type === 'liked') {
            setLikedPosts(prev => {
              const updated = { ...prev };
              filteredPosts.forEach(p => updated[p.id] = true);
              return updated;
            });
          }
        }
      }

      // Fetch saved status for liked posts
      if (type === 'liked' && currentUserId) {
        const { data: savedData } = await supabase
          .from('post_saves')
          .select('post_id')
          .eq('user_id', currentUserId);
        
        if (savedData) {
          const savedMap: { [key: string]: boolean } = {};
          savedData.forEach(item => savedMap[item.post_id] = true);
          setSavedPosts(savedMap);
        }
      }

      // Fetch liked status for saved posts (only on initial load)
      if (type === 'saved' && isInitial) {
        const idOrToken = userIdOrToken || currentUserId || getPrimaryGuestToken();
        const { data: likedData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', idOrToken);
        
        if (likedData) {
          const likedMap: { [key: string]: boolean } = {};
          likedData.forEach(item => likedMap[item.post_id] = true);
          setLikedPosts(likedMap);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [type, userIdOrToken, currentSession, tab, searchTerm, status, page, loadingMore]);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
  }, [fetchPosts]);

  return {
    posts,
    page,
    hasMore,
    loadingMore,
    session: currentSession,
    likedPosts,
    savedPosts,
    setPosts,
    setPage,
    setHasMore,
    setLikedPosts,
    setSavedPosts,
    fetchPosts,
    refreshData,
  };
}
