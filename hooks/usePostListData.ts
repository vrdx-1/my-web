'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { LIST_FEED_PAGE_SIZE } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { sequentialAppendItems } from '@/utils/preloadSequential';

/** แคช feed ต่อ type+user — กลับมาหน้า liked/saved/my-posts ไม่แสดง Skeleton (แบบ Facebook) */
const FEED_LIST_CACHE_MAX = 6;
const feedListCache: Record<string, { posts: any[]; hasMore: boolean }> = {};
function getFeedListCacheKey(type: string, session: any): string {
  const uid = session?.user?.id;
  return `${type}:${uid ? uid : 'guest'}`;
}

export type PostListType = 'saved' | 'liked' | 'sold' | 'my-posts';

export interface PostListLikedSavedShared {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface UsePostListDataOptions {
  type: PostListType;
  userIdOrToken?: string;
  session?: any;
  /** เมื่อ true = รู้แล้วว่าใครล็อกอิน แล้วค่อยโหลด (ใช้ session จาก context) */
  sessionReady?: boolean;
  tab?: string;
  status?: string; // สำหรับ sold page
  loadAll?: boolean; // โหลดทั้งหมดครั้งเดียว (ใช้กับ saved/liked/my-posts)
  /** สำหรับ type 'sold' ในหน้าโฮม: ใช้ liked/saved นี้แทนโหลดเอง (ลด request ซ้ำ) */
  sharedLikedSaved?: PostListLikedSavedShared | null;
  /** สำหรับ type 'sold' ในหน้าโฮม: กรองตามจังหวัด (ທຸກແຂວງ ถ้าว่าง) */
  province?: string;
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
  const { type, userIdOrToken, session, sessionReady = true, tab, status, loadAll = false, sharedLikedSaved, province } = options;
  
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(sessionReady ? session : undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const fetchIdRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);

  useEffect(() => {
    // เมื่อ sessionReady = true ใช้ session ตรงๆ (รวม null = guest) เพื่อให้แท็บขายแล้วโหลดได้แม้ไม่ล็อกอิน
    if (sessionReady) setCurrentSession(session);
    else setCurrentSession(undefined);
  }, [session, sessionReady]);

  const cacheableTypes: PostListType[] = ['liked', 'saved', 'my-posts'];
  useEffect(() => {
    if (!cacheableTypes.includes(type) || currentSession === undefined) return;
    const key = getFeedListCacheKey(type, currentSession);
    const cached = feedListCache[key];
    if (cached && cached.posts.length >= 0) {
      setPosts(cached.posts);
      setHasMore(cached.hasMore);
      setLoadingMore(false);
      hydratedFromCacheRef.current = true;
    }
  }, [type, currentSession]);

  useEffect(() => {
    if (!cacheableTypes.includes(type) || currentSession === undefined || loadingMore || posts.length === 0) return;
    const key = getFeedListCacheKey(type, currentSession);
    const keys = Object.keys(feedListCache);
    if (keys.length >= FEED_LIST_CACHE_MAX) {
      const toDelete = keys.filter((k) => k !== key).slice(0, keys.length - FEED_LIST_CACHE_MAX + 1);
      toDelete.forEach((k) => delete feedListCache[k]);
    }
    feedListCache[key] = { posts: [...posts], hasMore };
  }, [type, currentSession, loadingMore, posts, hasMore]);

  // โหลด like/save สำหรับหน้า sold ทันทีที่ session พร้อม (ให้เหมือนหน้าโฮม) — ข้ามถ้ามี sharedLikedSaved
  useEffect(() => {
    if (type !== 'sold' || currentSession === undefined || sharedLikedSaved) return;
    let idOrToken: string | null = null;
    if (userIdOrToken && typeof userIdOrToken === 'string' && userIdOrToken !== 'null' && userIdOrToken !== 'undefined' && userIdOrToken !== '') {
      idOrToken = userIdOrToken;
    } else if (currentSession?.user?.id) {
      const uid = currentSession.user.id;
      if (typeof uid === 'string' && uid !== 'null' && uid !== 'undefined' && uid !== '' && /^[0-9a-f-]{36}$/i.test(uid)) {
        idOrToken = uid;
      }
    }
    if (!idOrToken && typeof window !== 'undefined') {
      try {
        const token = getPrimaryGuestToken();
        if (token && typeof token === 'string' && token !== 'null' && token !== '') idOrToken = token;
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
  }, [type, currentSession, userIdOrToken, sharedLikedSaved]);

  const likedPostsOut = type === 'sold' && sharedLikedSaved ? sharedLikedSaved.likedPosts : likedPosts;
  const savedPostsOut = type === 'sold' && sharedLikedSaved ? sharedLikedSaved.savedPosts : savedPosts;
  const setLikedPostsOut = type === 'sold' && sharedLikedSaved ? sharedLikedSaved.setLikedPosts : setLikedPosts;
  const setSavedPostsOut = type === 'sold' && sharedLikedSaved ? sharedLikedSaved.setSavedPosts : setSavedPosts;

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number) => {
    if (currentSession === undefined) return;
    if (loadingMore && !isInitial) return;

    const currentFetchId = ++fetchIdRef.current;
    const skipSkeleton = isInitial && cacheableTypes.includes(type) && hydratedFromCacheRef.current;
    if (!skipSkeleton) setLoadingMore(true);
    
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : page);
    // ใช้ LIST_FEED_PAGE_SIZE เพื่อโหลดครบตาม backend: หน้า 0 = [0..19], หน้า 1 = [20..39], ...
    const rangeStart = currentPage * LIST_FEED_PAGE_SIZE;
    const rangeEnd = rangeStart + LIST_FEED_PAGE_SIZE - 1;
    
    // ตรวจสอบ currentUserId อย่างเข้มงวด - ต้องไม่เป็น null, undefined, หรือ string "null"
    let currentUserId: string | null = null;
    if (currentSession?.user?.id) {
      const userId = currentSession.user.id;
      // ตรวจสอบว่าเป็น string และไม่ใช่ "null" หรือ "undefined"
      if (typeof userId === 'string' && 
          userId !== 'null' && 
          userId !== 'undefined' && 
          userId !== '' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        currentUserId = userId;
      }
    }

    let soldWillClearLoadingInOnDone = false;
    try {
      let postIds: string[] = [];

      // Helper function to safely get idOrToken
      // ใช้ logic เดียวกับ saved page ที่ทำงานได้
      const getIdOrToken = (): string | null => {
        // ตรวจสอบ userIdOrToken ก่อน
        if (userIdOrToken && 
            userIdOrToken !== 'null' && 
            userIdOrToken !== 'undefined' && 
            userIdOrToken !== '' &&
            typeof userIdOrToken === 'string' &&
            userIdOrToken.length > 0 &&
            !userIdOrToken.includes('null')) {
          return userIdOrToken;
        }
        
        // ใช้ currentUserId ที่ตรวจสอบแล้ว (สำหรับ logged in user)
        if (currentUserId && 
            typeof currentUserId === 'string' &&
            currentUserId !== 'null' &&
            currentUserId !== 'undefined' &&
            currentUserId.length > 0 &&
            !currentUserId.includes('null')) {
          return currentUserId;
        }
        
        // ใช้ guest token เป็น fallback (สำหรับ guest user)
        if (typeof window !== 'undefined') {
          try {
            const guestToken = getPrimaryGuestToken();
            if (guestToken && 
                guestToken !== 'null' && 
                guestToken !== 'undefined' && 
                guestToken !== '' &&
                typeof guestToken === 'string' &&
                guestToken.length > 0 &&
                !guestToken.includes('null')) {
              return guestToken;
            }
          } catch (err) {
            console.error('Error getting guest token:', err);
          }
        }
        return null;
      };

      // ดึง post_ids ตาม type
      if (type === 'saved') {
        const idOrToken = getIdOrToken();
        
        // ถ้าไม่มี idOrToken ให้หยุดการโหลด
        if (!idOrToken) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const isUser = !!currentUserId;
        const table = isUser ? 'post_saves' : 'post_saves_guest';
        const column = isUser ? 'user_id' : 'guest_token';
        
        if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        let savesQuery = supabase
          .from(table)
          .select('post_id')
          .eq(column, idOrToken)
          .order('created_at', { ascending: false });

        // ถ้าไม่ได้ตั้งค่า loadAll ให้ใช้ pagination ตามเดิม
        if (!loadAll) {
          savesQuery = savesQuery.range(rangeStart, rangeEnd);
        }

        const { data: savesData, error: savesError } = await savesQuery;
        
        if (savesError) {
          console.error('Error fetching saved posts:', savesError, { 
            idOrToken, 
            table, 
            column, 
            isUser,
            errorCode: savesError.code,
            errorMessage: savesError.message,
            errorDetails: savesError.details,
            errorHint: savesError.hint
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (!savesData) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        postIds = savesData
          .map(item => item.post_id)
          .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
      } else if (type === 'liked') {
        const idOrToken = getIdOrToken();
        
        // ถ้าไม่มี idOrToken ให้หยุดการโหลด
        if (!idOrToken) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const isUser = !!currentUserId;
        const table = isUser ? 'post_likes' : 'post_likes_guest';
        const column = isUser ? 'user_id' : 'guest_token';
        
        // ตรวจสอบอีกครั้งก่อน query - ป้องกันการส่ง "null" ไปยัง database
        if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
          console.error('usePostListData: Attempted to query with invalid idOrToken', { idOrToken, type: 'liked', table, column });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        
        let likesQuery = supabase
          .from(table)
          .select('post_id')
          .eq(column, idOrToken)
          .order('created_at', { ascending: false });

        // ถ้าไม่ได้ตั้งค่า loadAll ให้ใช้ pagination ตามเดิม
        if (!loadAll) {
          likesQuery = likesQuery.range(rangeStart, rangeEnd);
        }

        const { data: likesData, error: likesError } = await likesQuery;
        
        if (likesError) {
          console.error('Error fetching liked posts:', likesError, { 
            idOrToken, 
            table, 
            column, 
            isUser,
            errorCode: likesError.code,
            errorMessage: likesError.message,
            errorDetails: likesError.details,
            errorHint: likesError.hint
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (!likesData) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        postIds = likesData
          .map(item => item.post_id)
          .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
      } else if (type === 'sold') {
        let soldQuery = supabase
          .from('cars')
          .select('id')
          .eq('status', status || 'sold')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeEnd);
        if (province && province.trim() !== '') {
          soldQuery = soldQuery.eq('province', province.trim());
        }
        const { data, error } = await soldQuery;

        if (error || !data) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        postIds = data.map((p: any) => p.id);
        // ได้น้อยกว่าหนึ่งหน้า = ไม่มีหน้าถัดไป → แสดง "ບໍ່ມີລາຍການເພີ່ມເຕີມ"
        if (postIds.length < LIST_FEED_PAGE_SIZE && fetchIdRef.current === currentFetchId) setHasMore(false);
      } else if (type === 'my-posts') {
        const idOrToken = getIdOrToken();
        
        // ถ้าไม่มี idOrToken หรือเป็น invalid value ให้หยุดการโหลด
        if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(idOrToken)) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        let idsQuery = supabase
          .from('cars')
          .select('id')
          .eq('user_id', idOrToken)
          .eq('status', tab || 'recommend')
          .order('created_at', { ascending: false });

        // ถ้าไม่ได้ตั้งค่า loadAll ให้ใช้ pagination ตามเดิม
        if (!loadAll) {
          idsQuery = idsQuery.range(rangeStart, rangeEnd);
        }

        const { data: idsData, error: idsError } = await idsQuery;
        
        if (idsError) {
          const errMsg = idsError?.message ?? idsError?.code ?? 'Unknown error';
          const errCode = idsError?.code ?? null;
          const errDetails = idsError?.details ?? null;
          const errHint = idsError?.hint ?? null;
          console.error(
            `Error fetching my-posts: ${errMsg}`,
            { code: errCode, details: errDetails, hint: errHint, idOrToken, tab, rangeStart, rangeEnd, type }
          );
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (!idsData) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        postIds = idsData.map(p => p.id);
      } else {
        // ถ้า type ไม่ตรงกับเงื่อนไขใดๆ ให้หยุดการโหลด
        if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
        return;
      }

      if (isInitial && fetchIdRef.current === currentFetchId && !skipSkeleton) {
        setPosts([]);
      }
      if (type === 'my-posts' && postIds.length === 0 && fetchIdRef.current === currentFetchId) {
        setHasMore(false);
      }

      // Batch loading: ดึง posts ทั้งหมดในครั้งเดียวแทนการ loop
      // Optimize: Select เฉพาะ fields ที่จำเป็นเท่านั้น
      if (postIds.length > 0) {
        // ตรวจสอบว่า postIds ไม่มี null หรือ undefined
        const validPostIds = postIds.filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
        
        if (validPostIds.length === 0) {
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const { data: postsData, error: postsError } = await supabase
          .from('cars')
          .select(POST_WITH_PROFILE_SELECT)
          .in('id', validPostIds)
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('Error fetching posts:', postsError, { 
            validPostIds,
            validPostIdsCount: validPostIds.length,
            type,
            errorCode: postsError.code,
            errorMessage: postsError.message,
            errorDetails: postsError.details,
            errorHint: postsError.hint
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        if (postsData) {
          // เรียงตามลำดับ postIds: liked/saved = กดล่าสุดก่อน, sold+search = ตาม cache order
          const orderedPostsData =
            type === 'saved' || type === 'liked'
              ? (() => {
                  const order = new Map<string, number>(validPostIds.map((id, idx) => [String(id), idx]));
                  return [...postsData].sort((a: any, b: any) => {
                    const ai = order.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER;
                    const bi = order.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                  });
                })()
              : postsData;

          // Filter logic for saved/liked/sold pages
          const filteredPosts = orderedPostsData.filter(postData => {
            if (type === 'saved' || type === 'liked') {
              const isNotHidden = !postData.is_hidden;
              const isOwner = currentUserId && postData.user_id === currentUserId;
              const matchesTab = tab ? postData.status === tab : true;
              return matchesTab && (isNotHidden || isOwner);
            }
            if (type === 'sold') {
              // Filter เฉพาะ posts ที่ status === 'sold' และไม่ถูกซ่อน
              return postData.status === 'sold' && !postData.is_hidden;
            }
            return true;
          });

          // เตรียมชุดโพสต์ใหม่สำหรับเติมเข้า state แบบ sequential
          const existingIds = new Set((isInitial ? [] : posts).map(p => p.id));
          const newPosts = filteredPosts.filter((p) => {
            if (existingIds.has(p.id)) return false;
            existingIds.add(p.id);
            return true;
          });

          // การตัดสินว่า "หมดแล้วหรือยัง"
          // - saved / liked: ดูจากจำนวน postIds ที่ได้จาก Supabase (ถ้าได้น้อยกว่าหนึ่งหน้า = สิ้นสุดลิสต์)
          // - my-posts: ผ่อนเงื่อนไขลง เหลือแค่ "ถ้าได้ 0 id" เท่านั้นถึงจะถือว่าหมด (กันเคสที่ Supabase คืนมาน้อยกว่าหนึ่งหน้า
          //   แต่ยังมีโพสต์หน้าถัดไป ซึ่งอาจเกิดจาก filter/RLS อื่น ๆ)
          if (fetchIdRef.current === currentFetchId) {
            if (loadAll) {
              // โหมดโหลดทั้งหมดครั้งเดียว: ไม่มีหน้าถัดไป
              setHasMore(false);
            } else if (type === 'sold') {
              // sold จัดการ hasMore ไปแล้วด้านบน (ทั้งกรณี search และไม่ search)
            } else {
              if (type === 'my-posts') {
                const noMoreIds = postIds.length === 0;
                setHasMore(!noMoreIds);
              } else {
                const reachedEndOfIds = postIds.length < LIST_FEED_PAGE_SIZE;
                setHasMore(!reachedEndOfIds); // ถ้าได้น้อยกว่าหนึ่งหน้า = สิ้นสุดลิสต์จริง ๆ
              }
            }
          }

          if (isInitial && fetchIdRef.current === currentFetchId && !skipSkeleton) setPosts([]);

          if (type === 'sold') {
            if (fetchIdRef.current === currentFetchId) {
              setPosts((prev) => {
                const ids = new Set(prev.map((p: any) => p.id));
                const toAdd = newPosts.filter((p: any) => !ids.has(p.id));
                return toAdd.length === 0 ? prev : [...prev, ...toAdd];
              });
              setLoadingMore(false);
            }
          } else if (skipSkeleton && isInitial && fetchIdRef.current === currentFetchId) {
            setPosts(filteredPosts);
            setLoadingMore(false);
          } else {
            sequentialAppendItems<any>({
              items: newPosts,
              append: (post) => {
                if (fetchIdRef.current !== currentFetchId) return;
                setPosts((prev) => {
                  if (prev.some((p: any) => p.id === post.id)) return prev;
                  return [...prev, post];
                });
              },
              onDone: () => {},
            });
          }

          // Update interaction status
        if (type === 'saved') {
            setSavedPosts(prev => {
              const updated = { ...prev };
              filteredPosts.forEach(p => {
                updated[p.id] = true;
              });
              return updated;
            });
          } else if (type === 'liked') {
            setLikedPosts(prev => {
              const updated = { ...prev };
              filteredPosts.forEach(p => {
                updated[p.id] = true;
              });
              return updated;
            });
          }

          // Fetch liked and saved status for my-posts (only on initial load)
          if (type === 'my-posts' && isInitial && filteredPosts.length > 0) {
            const idOrToken = getIdOrToken();
            // ตรวจสอบอย่างเข้มงวด - ต้องไม่เป็น null, undefined, empty string, หรือ string "null"
            if (idOrToken && 
                idOrToken !== 'null' && 
                idOrToken !== 'undefined' && 
                idOrToken !== '' &&
                typeof idOrToken === 'string' &&
                idOrToken.length > 0 &&
                !idOrToken.includes('null')) {
              const isUser = !!currentUserId;
              
              // Fetch liked status
              try {
                const likesTable = isUser ? 'post_likes' : 'post_likes_guest';
                const likesColumn = isUser ? 'user_id' : 'guest_token';
                const { data: likedData, error: likedError } = await supabase
                  .from(likesTable)
                  .select('post_id')
                  .eq(likesColumn, idOrToken);
                
                if (!likedError && likedData) {
                  const likedMap: { [key: string]: boolean } = {};
                  likedData.forEach(item => likedMap[item.post_id] = true);
                  setLikedPosts(prev => ({ ...prev, ...likedMap }));
                }
              } catch (err) {
                console.error('Exception fetching liked status for my-posts:', err);
              }
              
              // Fetch saved status
              try {
                const savesTable = isUser ? 'post_saves' : 'post_saves_guest';
                const savesColumn = isUser ? 'user_id' : 'guest_token';
                const { data: savedData, error: savedError } = await supabase
                  .from(savesTable)
                  .select('post_id')
                  .eq(savesColumn, idOrToken);
                
                if (!savedError && savedData) {
                  const savedMap: { [key: string]: boolean } = {};
                  savedData.forEach(item => savedMap[item.post_id] = true);
                  setSavedPosts(prev => ({ ...prev, ...savedMap }));
                }
              } catch (err) {
                console.error('Exception fetching saved status for my-posts:', err);
              }
            }
          }
        }
      }

      // Fetch saved status for liked posts
      // ใช้ logic เดียวกับ saved page - ตรวจสอบให้แน่ใจว่า idOrToken ไม่เป็น "null"
      if (type === 'liked') {
        const idOrToken = getIdOrToken();
        // ตรวจสอบอย่างเข้มงวด - ต้องไม่เป็น null, undefined, empty string, หรือ string "null"
        if (idOrToken && 
            idOrToken !== 'null' && 
            idOrToken !== 'undefined' && 
            idOrToken !== '' &&
            typeof idOrToken === 'string' &&
            idOrToken.length > 0 &&
            !idOrToken.includes('null')) { // ตรวจสอบเพิ่มเติมว่าไม่มี "null" ใน string
          const isUser = !!currentUserId;
          const table = isUser ? 'post_saves' : 'post_saves_guest';
          const column = isUser ? 'user_id' : 'guest_token';
          
          // ตรวจสอบอีกครั้งก่อน query - ป้องกันการส่ง "null" ไปยัง database
          if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
            console.error('usePostListData: Attempted to fetch saved status with invalid idOrToken', { idOrToken, type: 'liked', table, column });
            return;
          }
          
          try {
            const { data: savedData, error: savedError } = await supabase
              .from(table)
              .select('post_id')
              .eq(column, idOrToken);
            
            if (savedError) {
              console.error('Error fetching saved status for liked posts:', savedError, { 
                idOrToken, 
                table, 
                column, 
                isUser, 
                currentUserId,
                errorCode: savedError.code,
                errorMessage: savedError.message,
                errorDetails: savedError.details,
                errorHint: savedError.hint
              });
            } else if (savedData) {
              const savedMap: { [key: string]: boolean } = {};
              savedData.forEach(item => savedMap[item.post_id] = true);
              setSavedPosts(savedMap);
            }
          } catch (err) {
            console.error('Exception fetching saved status:', err, { idOrToken, table, column, currentUserId });
          }
        }
      }

      // Fetch liked status for saved posts (only on initial load)
      // ใช้ logic เดียวกับ saved page - ตรวจสอบให้แน่ใจว่า idOrToken ไม่เป็น "null"
      if (type === 'saved' && isInitial) {
        const idOrToken = getIdOrToken();
        // ตรวจสอบอย่างเข้มงวด - ต้องไม่เป็น null, undefined, empty string, หรือ string "null"
        if (idOrToken && 
            idOrToken !== 'null' && 
            idOrToken !== 'undefined' && 
            idOrToken !== '' &&
            typeof idOrToken === 'string' &&
            idOrToken.length > 0 &&
            !idOrToken.includes('null')) { // ตรวจสอบเพิ่มเติมว่าไม่มี "null" ใน string
          const isUser = !!currentUserId;
          const table = isUser ? 'post_likes' : 'post_likes_guest';
          const column = isUser ? 'user_id' : 'guest_token';
          
          // ตรวจสอบอีกครั้งก่อน query - ป้องกันการส่ง "null" ไปยัง database
          if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
            console.error('usePostListData: Attempted to fetch liked status with invalid idOrToken', { idOrToken, type: 'saved', table, column });
            return;
          }
          
          try {
            const { data: likedData, error: likedError } = await supabase
              .from(table)
              .select('post_id')
              .eq(column, idOrToken);
            
            if (likedError) {
              console.error('Error fetching liked status for saved posts:', likedError, { 
                idOrToken, 
                table, 
                column, 
                isUser, 
                currentUserId,
                errorCode: likedError.code,
                errorMessage: likedError.message,
                errorDetails: likedError.details,
                errorHint: likedError.hint
              });
            } else if (likedData) {
              const likedMap: { [key: string]: boolean } = {};
              likedData.forEach(item => likedMap[item.post_id] = true);
              setLikedPosts(likedMap);
            }
          } catch (err) {
            console.error('Exception fetching liked status:', err, { idOrToken, table, column, currentUserId });
          }
        }
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      if (skipSkeleton) hydratedFromCacheRef.current = false;
      if (!soldWillClearLoadingInOnDone && fetchIdRef.current === currentFetchId) {
        setLoadingMore(false);
      }
    }
  }, [type, userIdOrToken, currentSession, tab, status, page, loadingMore, loadAll, province]);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
  }, [fetchPosts]);

  // โหลดหน้าถัดไปอัตโนมัติจนหมด — ทั้งกรณีได้ครบหนึ่งหน้า และกรณีได้น้อยกว่าหนึ่งหน้า (filter/ซ้ำ) ก็โหลดต่อ
  // ยกเว้น type 'my-posts' ที่ใช้ infinite scroll ภายนอกเป็นตัวควบคุมการเปลี่ยนหน้า (กัน page กระโดดข้าม)
  useEffect(() => {
    if (type === 'my-posts' || loadAll) return;
    if (!hasMore || loadingMore) return;
    const expectedFull = (page + 1) * LIST_FEED_PAGE_SIZE;
    const gotFullPage = posts.length === expectedFull;
    const gotPartialPage = posts.length > page * LIST_FEED_PAGE_SIZE && posts.length < expectedFull;
    if (gotFullPage || gotPartialPage) setPage((p) => p + 1);
  }, [posts.length, hasMore, loadingMore, page, type, loadAll]);

  return {
    posts,
    page,
    hasMore,
    loadingMore,
    session: currentSession,
    likedPosts: likedPostsOut,
    savedPosts: savedPostsOut,
    setPosts,
    setPage,
    setHasMore,
    setLikedPosts: setLikedPostsOut,
    setSavedPosts: setSavedPostsOut,
    fetchPosts,
    refreshData,
  };
}
