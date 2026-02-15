'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { LIST_FEED_PAGE_SIZE } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { captionHasSearchLanguage, captionMatchesAnyAlias, detectSearchLanguage, expandCarSearchAliases } from '@/utils/postUtils';
import { LAO_PROVINCES } from '@/utils/constants';
import { sequentialAppendItems } from '@/utils/preloadSequential';

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
  // Initialize currentSession - ถ้า session ถูกส่งมาใช้เลย ถ้าไม่รอให้ useEffect initialize
  const [currentSession, setCurrentSession] = useState<any>(session ?? undefined);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const soldSearchScanCacheRef = useRef<{
    term: string;
    scannedUntil: number;
    sourceExhausted: boolean;
    matchedIds: string[];
    primaryCount: number;
    provinceTerm: string | null;
  } | null>(null);
  /** ป้องกันผลของ fetch เก่าเขียนทับเมื่อสลับแท็บเร็ว (คลิกครั้งเดียวสลับฝั่ง) */
  const fetchIdRef = useRef(0);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (session === undefined) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setCurrentSession(currentSession);
      } else {
        setCurrentSession(session);
      }
    };
    initSession();
  }, [session]);

  // โหลด like/save สำหรับหน้า sold ทันทีที่ session พร้อม (ให้เหมือนหน้าโฮม)
  useEffect(() => {
    if (type !== 'sold' || currentSession === undefined) return;
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
  }, [type, currentSession, userIdOrToken]);

  const fetchPosts = useCallback(async (isInitial = false, pageToFetch?: number) => {
    if (loadingMore && !isInitial) return;

    const currentFetchId = ++fetchIdRef.current;

    // รอให้ session ถูก initialize ก่อน (session อาจเป็น null สำหรับ guest)
    // แต่ต้องรอให้ useEffect initialize session เสร็จก่อน (ไม่ใช่ undefined)
    if (currentSession === undefined) {
      return;
    }
    
    setLoadingMore(true);
    
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
          console.log('getIdOrToken: Using userIdOrToken', { userIdOrToken });
          return userIdOrToken;
        }
        
        // ใช้ currentUserId ที่ตรวจสอบแล้ว (สำหรับ logged in user)
        if (currentUserId && 
            typeof currentUserId === 'string' &&
            currentUserId !== 'null' &&
            currentUserId !== 'undefined' &&
            currentUserId.length > 0 &&
            !currentUserId.includes('null')) {
          console.log('getIdOrToken: Using currentUserId', { currentUserId });
          return currentUserId;
        }
        
        // ใช้ guest token เป็น fallback (สำหรับ guest user)
        // getPrimaryGuestToken() จะ return guest token เสมอ (สร้างใหม่ถ้ายังไม่มี)
        // แต่ถ้า window เป็น undefined (SSR) จะ return empty string
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
              console.log('getIdOrToken: Using guestToken', { guestToken });
              return guestToken;
            } else {
              console.warn('getIdOrToken: Invalid guestToken', { guestToken });
            }
          } catch (err) {
            console.error('Error getting guest token:', err);
          }
        } else {
          console.warn('getIdOrToken: window is undefined (SSR)');
        }
        
        // ถ้าไม่มีอะไรเลย return null (จะไม่ query database)
        console.warn('getIdOrToken: No valid idOrToken found', { 
          userIdOrToken, 
          currentUserId, 
          currentSession: currentSession ? 'exists' : 'null',
          window: typeof window !== 'undefined' ? 'exists' : 'undefined'
        });
        return null;
      };

      // ดึง post_ids ตาม type
      if (type === 'saved') {
        const idOrToken = getIdOrToken();
        
        // ถ้าไม่มี idOrToken ให้หยุดการโหลด
        if (!idOrToken) {
          console.warn('usePostListData: No valid idOrToken for saved posts', { 
            type, 
            userIdOrToken, 
            currentUserId, 
            currentSession: currentSession ? 'exists' : 'null' 
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        // ตรวจสอบอีกครั้งก่อน query
        if (idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          console.error('usePostListData: Invalid idOrToken detected', { idOrToken, type: 'saved' });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const isUser = !!currentUserId;
        const table = isUser ? 'post_saves' : 'post_saves_guest';
        const column = isUser ? 'user_id' : 'guest_token';
        
        // ตรวจสอบอีกครั้งก่อน query - ป้องกันการส่ง "null" ไปยัง database
        if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
          console.error('usePostListData: Attempted to query with invalid idOrToken', { idOrToken, type: 'saved', table, column });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        console.log('usePostListData: Querying saved posts', { idOrToken, table, column, isUser, rangeStart, rangeEnd });
        
        const { data: savesData, error: savesError } = await supabase
          .from(table)
          .select('post_id')
          .eq(column, idOrToken)
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeEnd);
        
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
          console.warn('usePostListData: No valid idOrToken for liked posts', { 
            type, 
            userIdOrToken, 
            currentUserId, 
            currentSession: currentSession ? 'exists' : 'null' 
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        // ตรวจสอบอีกครั้งก่อน query
        if (idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          console.error('usePostListData: Invalid idOrToken detected', { idOrToken, type: 'liked' });
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
        
        console.log('usePostListData: Querying liked posts', { idOrToken, table, column, isUser, rangeStart, rangeEnd });
        
        const { data: likesData, error: likesError } = await supabase
          .from(table)
          .select('post_id')
          .eq(column, idOrToken)
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeEnd);
        
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
        const term = (searchTerm ?? '').trim();
        if (term) {
          const termKey = term;
          const provinceTerm =
            LAO_PROVINCES.find((p) => term.includes(p)) ?? null;
          if (isInitial || !soldSearchScanCacheRef.current || soldSearchScanCacheRef.current.term !== termKey) {
            soldSearchScanCacheRef.current = {
              term: termKey,
              scannedUntil: 0,
              sourceExhausted: false,
              matchedIds: [],
              primaryCount: 0,
              provinceTerm,
            };
          }

          const cache = soldSearchScanCacheRef.current;
          const neededEnd = rangeEnd + 1;
          const batchSize = 80;
          const expandedTerms = expandCarSearchAliases(term);
          const searchLang = detectSearchLanguage(term);

          while (cache && cache.matchedIds.length < neededEnd && !cache.sourceExhausted) {
            const from = cache.scannedUntil;
            const to = from + batchSize - 1;

            const { data, error } = await supabase
              .from('cars')
              .select('id, caption, province')
              .eq('status', status || 'sold')
              .eq('is_hidden', false)
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
              const match = expandedTerms.length > 0
                ? captionMatchesAnyAlias(caption, expandedTerms)
                : captionIncludesSearch(caption, term);
              if (match) {
                const id = String(row.id);
                const isLangPrimary =
                  searchLang === 'other' ? true : captionHasSearchLanguage(caption, searchLang);

                const provinceTerm = cache.provinceTerm;
                const isProvincePrimary = !!provinceTerm && province === provinceTerm;

                if (isProvincePrimary) {
                  cache.matchedIds.splice(0, 0, id);
                  cache.primaryCount += 1;
                } else if (isLangPrimary) {
                  cache.matchedIds.splice(cache.primaryCount, 0, id);
                  cache.primaryCount += 1;
                } else {
                  cache.matchedIds.push(id);
                }
              }
            }
          }

          postIds = (cache?.matchedIds ?? []).slice(rangeStart, neededEnd);
          if (fetchIdRef.current === currentFetchId) setHasMore(!!(cache && (!cache.sourceExhausted || cache.matchedIds.length > neededEnd)));
        } else {
          let query = supabase
            .from('cars')
            .select('id')
            .eq('status', status || 'sold')
            .eq('is_hidden', false)
            .order('created_at', { ascending: false })
            .range(rangeStart, rangeEnd);

          const { data, error } = await query;
          if (error || !data) {
            if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
            return;
          }
          postIds = data.map((p: any) => p.id);
          if (postIds.length === 0 && fetchIdRef.current === currentFetchId) setHasMore(false);
        }
      } else if (type === 'my-posts') {
        const idOrToken = getIdOrToken();
        
        // ถ้าไม่มี idOrToken หรือเป็น invalid value ให้หยุดการโหลด
        if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '') {
          console.warn('usePostListData: No valid idOrToken for my-posts', { 
            type, 
            userIdOrToken, 
            currentUserId, 
            currentSession: currentSession ? 'exists' : 'null' 
          });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        const { data: idsData, error: idsError } = await supabase
          .from('cars')
          .select('id')
          .eq('user_id', idOrToken)
          .eq('status', tab || 'recommend')
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeEnd);
        
        if (idsError) {
          console.error('Error fetching my-posts:', idsError, { idOrToken });
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

      // Batch loading: ดึง posts ทั้งหมดในครั้งเดียวแทนการ loop
      // Optimize: Select เฉพาะ fields ที่จำเป็นเท่านั้น
      if (postIds.length > 0) {
        // ตรวจสอบว่า postIds ไม่มี null หรือ undefined
        const validPostIds = postIds.filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
        
        if (validPostIds.length === 0) {
          console.warn('usePostListData: No valid postIds after filtering', { postIds, type });
          if (fetchIdRef.current === currentFetchId) { setLoadingMore(false); setHasMore(false); }
          return;
        }
        
        console.log('usePostListData: Fetching posts', { 
          postIdsCount: postIds.length, 
          validPostIdsCount: validPostIds.length,
          type 
        });
        
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
          const orderedPostsData =
            (type === 'sold' && (searchTerm ?? '').trim())
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

          // ถ้าไม่มีโพสต์ใหม่เพิ่มเลย แสดงว่า "หมดแล้วจริงๆ" สำหรับลิสต์นี้
          if (fetchIdRef.current === currentFetchId) {
            if (newPosts.length === 0) setHasMore(false);
            else setHasMore(postIds.length >= LIST_FEED_PAGE_SIZE); // ได้ครบหนึ่งหน้าขึ้นไป = โหลดต่อจนได้น้อยกว่าหนึ่งหน้า
          }

          // ถ้าเป็นการโหลดใหม่ ให้ล้างรายการเก่าก่อน
          if (isInitial && fetchIdRef.current === currentFetchId) setPosts([]);

          // หน้า sold: ใส่โพสต์ครั้งเดียวแล้วปิด loading ทันที (ไม่พึ่ง rAF/onDone เพื่อไม่ให้ไอคอนโหลดค้าง)
          if (type === 'sold') {
            if (fetchIdRef.current === currentFetchId) {
              setPosts((prev) => {
                const ids = new Set(prev.map((p: any) => p.id));
                const toAdd = newPosts.filter((p: any) => !ids.has(p.id));
                return toAdd.length === 0 ? prev : [...prev, ...toAdd];
              });
              setLoadingMore(false);
            }
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
            console.log('usePostListData: Fetching saved status for liked posts', { idOrToken, table, column, isUser });
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
        } else {
          // ถ้า idOrToken ไม่ valid ให้ skip การ fetch saved status
          console.warn('Skipping saved status fetch for liked posts - invalid idOrToken', { 
            idOrToken, 
            currentUserId, 
            currentSession: currentSession ? 'exists' : 'null' 
          });
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
            console.log('usePostListData: Fetching liked status for saved posts', { idOrToken, table, column, isUser });
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
        } else {
          // ถ้า idOrToken ไม่ valid ให้ skip การ fetch liked status
          console.warn('Skipping liked status fetch for saved posts - invalid idOrToken', { 
            idOrToken, 
            currentUserId, 
            currentSession: currentSession ? 'exists' : 'null' 
          });
        }
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      if (!soldWillClearLoadingInOnDone && fetchIdRef.current === currentFetchId) {
        setLoadingMore(false);
      }
    }
  }, [type, userIdOrToken, currentSession, tab, searchTerm, status, page, loadingMore]);

  const refreshData = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await fetchPosts(true);
  }, [fetchPosts]);

  // โหลดหน้าถัดไปอัตโนมัติจนหมด — ทั้งกรณีได้ครบหนึ่งหน้า และกรณีได้น้อยกว่าหนึ่งหน้า (filter/ซ้ำ) ก็โหลดต่อ
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const expectedFull = (page + 1) * LIST_FEED_PAGE_SIZE;
    const gotFullPage = posts.length === expectedFull;
    const gotPartialPage = posts.length > page * LIST_FEED_PAGE_SIZE && posts.length < expectedFull;
    if (gotFullPage || gotPartialPage) setPage((p) => p + 1);
  }, [posts.length, hasMore, loadingMore, page]);

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
