'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken, expandWithoutBrandAliases } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { safeParseJSON } from '@/utils/storageUtils';
import { LAO_PROVINCES } from '@/utils/constants';
import carsData from '@/data';
import categoriesData from '@/data/categories.json';

function normalizeCaptionSearch(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeCarSearch(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * สร้าง index สำหรับเช็กว่า query เป็นหมวดหมู่หรือไม่
 */
function buildCategoryAliasIndex() {
  const aliasToCategoryIds = new Map<string, Set<string>>();

  function addAlias(categoryId: string, raw: string) {
    const v = String(raw ?? '').trim();
    if (!v) return;
    const k = normalizeCarSearch(v);
    if (!k) return;
    if (!aliasToCategoryIds.has(k)) aliasToCategoryIds.set(k, new Set());
    aliasToCategoryIds.get(k)!.add(String(categoryId));
  }

  const groups = (categoriesData as any).categoryGroups ?? [];
  for (const group of groups) {
    for (const cat of group.categories ?? []) {
      const id = String(cat.id);
      addAlias(id, id);
      addAlias(id, cat.name);
      addAlias(id, cat.nameLo);
      addAlias(id, cat.nameEn);
    }
  }

  const searchTermAliases = (categoriesData as any).searchTermAliases ?? [];
  for (const entry of searchTermAliases) {
    const terms = entry.terms ?? [];
    const categoryIds = entry.categoryIds ?? [];
    for (const term of terms) {
      for (const cid of categoryIds) addAlias(String(cid), term);
    }
  }

  addAlias('offroad', 'jeep');
  addAlias('offroad', 'จี๊ป');
  addAlias('offroad', 'จิบ');
  addAlias('offroad', 'ຈີບ');
  addAlias('pickup', 'truck');
  addAlias('pickup', 'รถกระบะ');
  addAlias('van', 'รถตู้');
  addAlias('sedan', 'รถเก๋ง');
  addAlias('electric', 'ev');
  addAlias('electric', 'electric car');
  addAlias('electric', 'รถไฟฟ้า');

  return { aliasToCategoryIds };
}

const CATEGORY_INDEX = buildCategoryAliasIndex();

/**
 * ดึงรายการชื่อรุ่นจาก data/brands สำหรับหมวดที่ระบุ (ส่งเฉพาะชื่อรุ่นจากพจนานุกรม)
 */
function getModelNamesFromCategory(query: string): string[] {
  const queryNorm = normalizeCarSearch(query);
  if (!queryNorm) return [];

  const categoryIds = CATEGORY_INDEX.aliasToCategoryIds.get(queryNorm);
  if (!categoryIds || categoryIds.size === 0) return [];

  const out = new Set<string>();
  const BRAND_NAMES_SET = (() => {
    const set = new Set<string>();
    for (const brand of carsData.brands ?? []) {
      const en = String(brand.brandName ?? '').trim();
      const th = String((brand as any).brandNameTh ?? '').trim();
      const lo = String((brand as any).brandNameLo ?? '').trim();
      if (en) set.add(en.toLowerCase().replace(/\s+/g, ' ').trim());
      if (th) set.add(th.toLowerCase().replace(/\s+/g, ' ').trim());
      if (lo) set.add(lo.toLowerCase().replace(/\s+/g, ' ').trim());
    }
    return set;
  })();

  function normalizeForFallback(text: string): string {
    return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  for (const cid of categoryIds) {
    for (const brand of carsData.brands ?? []) {
      for (const model of brand.models ?? []) {
        const modelCats = (model.categoryIds ?? []) as string[];
        if (!modelCats.includes(String(cid))) continue;
        const terms = [
          model.modelName,
          (model as any).modelNameTh,
          (model as any).modelNameLo,
          ...((model.searchNames ?? []) as any[]).map(String),
        ];
        for (const t of terms) {
          const s = String(t ?? '').trim();
          if (!s) continue;
          if (BRAND_NAMES_SET.has(normalizeForFallback(s))) continue;
          out.add(s);
        }
      }
    }
  }

  return Array.from(out).filter(Boolean);
}

function captionIncludesSearch(caption: string, query: string): boolean {
  const q = normalizeCaptionSearch(query);
  if (!q) return false;
  const c = normalizeCaptionSearch(caption);
  return c.includes(q);
}

const THAI_RE = /[\u0E00-\u0E7F]/;
const LAO_RE = /[\u0E80-\u0EFF]/;
const LATIN_RE = /[a-zA-Z0-9]/;

/** ตรวจว่าตัวอักษรอยู่ในสคริปต์ไหน */
function getScript(c: string): 'latin' | 'thai' | 'lao' | 'other' {
  if (LATIN_RE.test(c)) return 'latin';
  if (THAI_RE.test(c)) return 'thai';
  if (LAO_RE.test(c)) return 'lao';
  return 'other';
}

/** ตรวจว่าตัวอักษรเป็นตัวอักษร/ตัวเลข (ใช้เช็กขอบคำ) */
function isWordChar(c: string): boolean {
  return /[\p{L}\p{N}]/u.test(c);
}

/**
 * เช็กว่าคำค้นมีขอบคำหรือไม่ (รองรับหลายสคริปต์: ละติน vs ไทย/ลาว)
 * ถ้าคำค้นเป็นละติน → ตัวอักษรไทย/ลาวที่อยู่ติดกันให้นับเป็นขอบคำ
 * ถ้าคำค้นเป็นไทย/ลาว → ตัวอักษรละตินที่อยู่ติดกันให้นับเป็นขอบคำ
 */
function hasWordBoundary(cap: string, termNorm: string, idx: number): boolean {
  const termScript = getScript(termNorm[0] || '');
  const beforeIdx = idx - 1;
  const afterIdx = idx + termNorm.length;

  // เช็กขอบคำด้านหน้า
  let beforeOk = false;
  if (beforeIdx < 0) {
    beforeOk = true; // อยู่ต้นข้อความ
  } else {
    const beforeChar = cap[beforeIdx];
    if (!isWordChar(beforeChar)) {
      beforeOk = true; // ไม่ใช่ตัวอักษร/ตัวเลข (ช่องว่าง/เครื่องหมาย)
    } else {
      const beforeScript = getScript(beforeChar);
      // ถ้าสคริปต์ต่างกัน (เช่น คำค้นเป็นละติน แต่ตัวอักษรข้างหน้าเป็นไทย) → นับเป็นขอบคำ
      if (termScript !== 'other' && beforeScript !== 'other' && termScript !== beforeScript) {
        beforeOk = true;
      }
    }
  }

  // เช็กขอบคำด้านหลัง
  let afterOk = false;
  if (afterIdx >= cap.length) {
    afterOk = true; // อยู่ท้ายข้อความ
  } else {
    const afterChar = cap[afterIdx];
    if (!isWordChar(afterChar)) {
      afterOk = true; // ไม่ใช่ตัวอักษร/ตัวเลข (ช่องว่าง/เครื่องหมาย)
    } else {
      const afterScript = getScript(afterChar);
      // ถ้าสคริปต์ต่างกัน (เช่น คำค้นเป็นละติน แต่ตัวอักษรข้างหลังเป็นไทย) → นับเป็นขอบคำ
      if (termScript !== 'other' && afterScript !== 'other' && termScript !== afterScript) {
        afterOk = true;
      }
    }
  }

  return beforeOk && afterOk;
}

/**
 * กรองโพสที่ caption ตรงคำค้นแบบ "ไม่เรียงกันเกินไป" — เหลือเฉพาะโพสที่คำค้นปรากฏเป็นคำเต็ม (มีขอบคำ)
 * ไม่นับคำที่ไปซ้อนในคำอื่น (เช่น "ev" ใน "seven")
 * รองรับหลายสคริปต์: ถ้าคำค้นเป็นละติน ตัวอักษรไทย/ลาวที่อยู่ติดกันให้นับเป็นขอบคำ
 */
function captionHasReasonableMatch(caption: string, searchTerms: string[]): boolean {
  const cap = normalizeCaptionSearch(caption);
  if (!cap) return false;
  for (const term of searchTerms) {
    const t = String(term ?? '').trim();
    if (!t) continue;
    const termNorm = normalizeCaptionSearch(t);
    if (!termNorm) continue;

    const idx = cap.indexOf(termNorm);
    if (idx === -1) continue;

    if (hasWordBoundary(cap, termNorm, idx)) {
      return true;
    }
  }
  return false;
}

/**
 * ใช้สำหรับกรอง "หมวดหมู่" โดยตรง:
 * caption ต้องมีชื่อรุ่นที่มาจาก data/brands อย่างน้อย 1 ชื่อ (หลัง normalize แล้วเป็น substring)
 * ไม่ใช้ heuristics อื่นเลย เพื่อให้ตรงกับพจนานุกรม 100%
 */
function captionHasDictionaryModelMatch(caption: string, modelNames: string[]): boolean {
  const cap = normalizeCaptionSearch(caption);
  if (!cap) return false;
  for (const name of modelNames) {
    const termNorm = normalizeCaptionSearch(String(name ?? '').trim());
    if (!termNorm) continue;
    if (cap.includes(termNorm)) return true;
  }
  return false;
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

    // เก็บคำค้นตอนเริ่ม request เพื่อเช็กตอนได้ response ว่าไม่ stale
    const trimmedSearch = String(searchTermRef.current ?? '')
      .normalize('NFKC')
      .trim();

    setLoadingMore(true);
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : pageRef.current);
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = startIndex + PREFETCH_COUNT - 1; // endIndex is inclusive

    let postIds: string[] = [];

    if (trimmedSearch) {
      // ฝั่ง frontend เลือกชุดคำค้น (ขยายเป็นไทย/ลาว/อังกฤษ เฉพาะรุ่นนั้น) แล้วส่งให้ API
      const expanded = expandWithoutBrandAliases(trimmedSearch);
      const searchTerms = (expanded.length > 0 ? expanded : [trimmedSearch])
        .map((t) => String(t ?? '').trim())
        .filter(Boolean);
      const res = await fetch('/api/posts/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerms, startIndex, endIndex }),
      });
      if (res.ok) {
        const json = await res.json();
        postIds = Array.isArray(json.postIds) ? json.postIds : [];
      }
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

    // ถ้าคำค้นเปลี่ยนไปแล้ว (มี request ใหม่ไปแล้ว) ไม่นำผลนี้มาใช้ — ลดอาการบางครั้งได้บางครั้งไม่ได้
    const currentSearch = String(searchTermRef.current ?? '').normalize('NFKC').trim();
    const isStale = currentSearch !== trimmedSearch;

    const newHasMore = postIds.length >= PREFETCH_COUNT;

    if (isStale) {
      setLoadingMore(false);
      return;
    }

    if (isInitial) {
      setPosts([]);
    }

    // Batch loading: ดึง posts ทั้งหมดในครั้งเดียวแทนการ loop
    if (postIds.length > 0) {
      const { data: postsData, error: postsError } = await supabase
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', postIds)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        let orderedPostsData = postsData;
        if (trimmedSearch) {
          // เช็กว่าเป็นการค้นหาหมวดหมู่หรือไม่
          const categoryModelNames = getModelNamesFromCategory(trimmedSearch);
          if (categoryModelNames.length > 0) {
            // ถ้าเป็นหมวดหมู่: ใช้เฉพาะชื่อรุ่นจาก data/brands
            orderedPostsData = postsData.filter((p: any) =>
              captionHasDictionaryModelMatch(p?.caption ?? '', categoryModelNames)
            );
          } else {
            // ถ้าไม่ใช่หมวดหมู่: ใช้วิธีเดิม
            const expanded = expandWithoutBrandAliases(trimmedSearch);
            const searchTermsForFilter = (expanded.length > 0 ? expanded : [trimmedSearch])
              .map((t) => String(t ?? '').trim())
              .filter(Boolean);
            orderedPostsData = postsData.filter((p: any) =>
              captionHasReasonableMatch(p?.caption ?? '', searchTermsForFilter)
            );
          }
        }
        const stillCurrent = String(searchTermRef.current ?? '').normalize('NFKC').trim() === trimmedSearch;
        requestAnimationFrame(() => {
          if (!stillCurrent) {
            setLoadingMore(false);
            return;
          }
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = orderedPostsData.filter((p: any) => !existingIds.has(p.id));
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

  // Fetch posts when search term changes (debounce เพื่อไม่ยิง request ทุก keystroke — ลด race ให้ smooth)
  const SEARCH_DEBOUNCE_MS = 350;
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    const t = setTimeout(() => {
      fetchPosts(true);
    }, SEARCH_DEBOUNCE_MS);
    if (searchTerm) {
      localStorage.setItem('last_searched_province', searchTerm);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

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
