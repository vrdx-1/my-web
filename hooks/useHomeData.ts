'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { safeParseJSON } from '@/utils/storageUtils';
import { captionHasSearchLanguage, captionMatchesAnyAlias, detectSearchLanguage, expandCarSearchAliases } from '@/utils/postUtils';
import { LAO_PROVINCES } from '@/utils/constants';

function normalizeCaptionSearch(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function captionIncludesSearch(caption: string, query: string): boolean {
  const q = normalizeCaptionSearch(query);
  if (!q) return false;
  const c = normalizeCaptionSearch(caption);
  return c.includes(q);
}

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

const PAGE_SIZE = 10;
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
  const searchTermRef = useRef(searchTerm);
  const searchScanCacheRef = useRef<{
    term: string;
    scannedUntil: number;
    sourceExhausted: boolean;
    matchedIds: string[];
    primaryCount: number;
    provinceTerm: string | null;
  } | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

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

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number) => {
    if (loadingMoreRef.current) return;
    
    setLoadingMore(true);
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : pageRef.current);
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = startIndex + PREFETCH_COUNT - 1; // endIndex is inclusive, so this will fetch PREFETCH_COUNT items

    let postIds: string[] = [];

    // ดึงข้อมูลเฉพาะสถานะ recommend เท่านั้น
    const trimmedSearch = (searchTermRef.current ?? '').trim();

    if (trimmedSearch) {
      // Dictionary-assisted caption search (Thai/Lao/English aliases).
      // We scan the feed in the same order, caching matches, so pagination still works.
      const termKey = trimmedSearch;
      const provinceTerm =
        LAO_PROVINCES.find((p) => trimmedSearch.includes(p)) ?? null;
      if (isInitial || !searchScanCacheRef.current || searchScanCacheRef.current.term !== termKey) {
        searchScanCacheRef.current = {
          term: termKey,
          scannedUntil: 0,
          sourceExhausted: false,
          matchedIds: [],
          primaryCount: 0,
          provinceTerm,
        };
      }

      const cache = searchScanCacheRef.current;
      const neededEnd = endIndex + 1; // slice end (exclusive)
      const batchSize = 80;
      const expandedTerms = expandCarSearchAliases(trimmedSearch);
      const searchLang = detectSearchLanguage(trimmedSearch);

      while (cache && cache.matchedIds.length < neededEnd && !cache.sourceExhausted) {
        const from = cache.scannedUntil;
        const to = from + batchSize - 1;

        const { data, error } = await supabase
          .from('cars')
          .select('id, caption, province')
          .eq('status', 'recommend')
          .eq('is_hidden', false)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error || !data) {
          cache.sourceExhausted = true;
          break;
        }

        if (data.length < batchSize) cache.sourceExhausted = true;
        cache.scannedUntil += batchSize;

        for (const row of data as any[]) {
          if (!cache) break;
          const caption = String(row.caption ?? '');
          const province = String(row.province ?? '');
          // Keep legacy behavior as fallback if dictionary yields nothing.
          const match = expandedTerms.length > 0
            ? captionMatchesAnyAlias(caption, expandedTerms)
            : captionIncludesSearch(caption, trimmedSearch);
          if (match) {
            const id = String(row.id);
            const isLangPrimary =
              searchLang === 'other' ? true : captionHasSearchLanguage(caption, searchLang);

            const provinceTerm = cache.provinceTerm;
            const isProvincePrimary = !!provinceTerm && province === provinceTerm;

            if (isProvincePrimary) {
              // รถในแขวงที่ผู้ใช้พิมพ์ → ดันขึ้นบนสุด
              cache.matchedIds.splice(0, 0, id);
              cache.primaryCount += 1;
            } else if (isLangPrimary) {
              // รถที่ภาษาตรงกับที่ผู้ใช้พิมพ์ → ตามหลังกลุ่มแขวงนั้น
              cache.matchedIds.splice(cache.primaryCount, 0, id);
              cache.primaryCount += 1;
            } else {
              // ที่เหลือทั้งหมด
              cache.matchedIds.push(id);
            }
          }
        }
      }

      postIds = (cache?.matchedIds ?? []).slice(startIndex, neededEnd);
    } else {
      const { data, error } = await supabase
        .from('cars')
        .select('id')
        .eq('status', 'recommend')
        .eq('is_hidden', false)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (!error && data) {
        postIds = data.map((p: any) => p.id);
      }
    }

    // hasMore ควรเป็น true ถ้ามี post เท่ากับ PREFETCH_COUNT (แสดงว่ายังมี post ให้โหลดต่อ)
    // ถ้ามี post น้อยกว่า PREFETCH_COUNT แสดงว่าโหลดหมดแล้ว
    // ใช้ >= แทน === เพื่อให้แน่ใจว่าถ้ามี post มากกว่าหรือเท่ากับ PREFETCH_COUNT จะยังโหลดต่อ
    const newHasMore = trimmedSearch
      ? (() => {
          const cache = searchScanCacheRef.current;
          const neededEnd = endIndex + 1;
          return !!(cache && (!cache.sourceExhausted || cache.matchedIds.length > neededEnd));
        })()
      : (postIds.length >= PREFETCH_COUNT);

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
        const orderedPostsData = trimmedSearch
          ? (() => {
              const order = new Map<string, number>(postIds.map((id, idx) => [String(id), idx]));
              return [...postsData].sort((a: any, b: any) => {
                const ai = order.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER;
                const bi = order.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER;
                return ai - bi;
              });
            })()
          : postsData;
        // ใช้ requestAnimationFrame เพื่อ batch state updates และลดการกระตุก
        requestAnimationFrame(() => {
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = orderedPostsData.filter(p => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
          setHasMore(newHasMore);
          setLoadingMore(false);
        });
      } else {
        setHasMore(newHasMore);
        setLoadingMore(false);
      }
    } else {
      setHasMore(newHasMore);
      setLoadingMore(false);
    }
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
    // ตรวจสอบว่า page > 0, hasMore = true, และไม่กำลัง loading
    if (page > 0 && hasMore && !loadingMore) {
      fetchPosts(false, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, hasMore, loadingMore]); // Depend on page, hasMore, and loadingMore

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
