'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken, expandWithoutBrandAliases } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { safeParseJSON } from '@/utils/storageUtils';
import { LAO_PROVINCES } from '@/utils/constants';
import categoriesData from '@/data/categories.json';
import { CATEGORY_MODELS } from '@/data/category-models';
import carsData from '@/data';

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

// Helper: normalize สำหรับ fallback lookup (ใช้เช็กคำค้นว่าเป็นชื่อยี่ห้อหรือไม่)
function normalizeForFallback(text: string): string {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Helper: ข้อมูลยี่ห้อสำหรับตรวจว่าคำค้นเป็น brand หรือไม่ + ดึงชื่อยี่ห้อทุกภาษาอย่างรวดเร็ว
const BRAND_NAMES_SET = new Set<string>();
const BRAND_ALIAS_MAP = new Map<string, string[]>();

(() => {
  for (const brand of (carsData as any).brands ?? []) {
    const en = String((brand as any).brandName ?? '').trim();
    const th = String((brand as any).brandNameTh ?? '').trim();
    const lo = String((brand as any).brandNameLo ?? '').trim();
    const aliases = [en, th, lo].filter(Boolean);
    if (aliases.length === 0) continue;

    for (const name of aliases) {
      const key = normalizeForFallback(name);
      if (!key) continue;
      BRAND_NAMES_SET.add(key);
      if (!BRAND_ALIAS_MAP.has(key)) {
        BRAND_ALIAS_MAP.set(key, aliases);
      }
    }
  }
})();

/**
 * ดึงรายการชื่อรุ่นจาก data/category-models สำหรับหมวดที่ระบุ
 */
function getModelNamesFromCategory(query: string): string[] {
  const queryNorm = normalizeCarSearch(query);
  if (!queryNorm) return [];

  const categoryIds = CATEGORY_INDEX.aliasToCategoryIds.get(queryNorm);
  if (!categoryIds || categoryIds.size === 0) return [];

  const out = new Set<string>();
  for (const cid of categoryIds) {
    const names = CATEGORY_MODELS[String(cid)];
    if (Array.isArray(names)) {
      for (const n of names) {
        const s = String(n ?? '').trim();
        if (s) out.add(s);
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
 * คำที่สั้นเกินไปหรือเป็นตัวเลขล้วนไม่นำมาใช้จับ caption (ลดโพสมั่วในหมวด SUV/sedan)
 */
function isTermTooNoisy(termNorm: string): boolean {
  if (!termNorm || termNorm.length < 2) return true;
  if (/^\d+$/.test(termNorm)) return true; // ตัวเลขล้วน เช่น 5, 03, 500, 127
  return false;
}

/**
 * ใช้สำหรับกรอง "หมวดหมู่" โดยตรง:
 * caption ต้องมีชื่อรุ่นจาก category-models อย่างน้อย 1 ชื่อ ที่ปรากฏเป็นคำเต็ม (มีขอบคำ)
 * ไม่ใช้คำที่สั้นเกินไปหรือเป็นตัวเลขล้วน เพื่อไม่ให้โพสมั่ว
 */
function captionHasDictionaryModelMatch(caption: string, modelNames: string[]): boolean {
  const cap = normalizeCaptionSearch(caption);
  if (!cap) return false;
  for (const name of modelNames) {
    const termNorm = normalizeCaptionSearch(String(name ?? '').trim());
    if (!termNorm || isTermTooNoisy(termNorm)) continue;
    const idx = cap.indexOf(termNorm);
    if (idx === -1) continue;
    if (hasWordBoundary(cap, termNorm, idx)) return true;
  }
  return false;
}

/**
 * คืนความยาวของชื่อรุ่นที่ยาวที่สุดที่ปรากฏใน caption แบบตรง 100% (มีขอบคำ ตัวอักษรเรียงกันเป๊ะ)
 * ไม่นับคำที่สั้นเกินไปหรือตัวเลขล้วน
 */
function getExactMatchScore(caption: string, modelNames: string[]): number {
  const cap = normalizeCaptionSearch(caption);
  if (!cap) return 0;
  let maxLen = 0;
  for (const name of modelNames) {
    const termNorm = normalizeCaptionSearch(String(name ?? '').trim());
    if (!termNorm || isTermTooNoisy(termNorm)) continue;
    const idx = cap.indexOf(termNorm);
    if (idx === -1) continue;
    if (hasWordBoundary(cap, termNorm, idx) && termNorm.length > maxLen) {
      maxLen = termNorm.length;
    }
  }
  return maxLen;
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

const PAGE_SIZE = 5; // โหลดครั้งแรก 5 items เพื่อให้เห็นผลเร็ว
const PREFETCH_COUNT = 3; // โหลดเพิ่มทีละ 3 items เพื่อให้ smooth เหมือน Facebook

// Simple search result cache ต่อคำค้น (ฝั่ง frontend เท่านั้น)
const SEARCH_CACHE_STORAGE_KEY = 'home_search_cache_v1';
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // เก็บผลค้นหาไว้ 5 นาที

type SearchCacheEntry = { posts: any[]; hasMore: boolean; timestamp: number };

function loadSearchCache(): Record<string, SearchCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SEARCH_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SearchCacheEntry>;
    const now = Date.now();
    const fresh: Record<string, SearchCacheEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.timestamp === 'number' && now - v.timestamp <= SEARCH_CACHE_TTL_MS) {
        fresh[k] = v;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function getCachedSearchResult(normKey: string): SearchCacheEntry | null {
  if (!normKey) return null;
  const cache = loadSearchCache();
  return cache[normKey] ?? null;
}

function saveSearchResultToCache(normKey: string, posts: any[], hasMore: boolean) {
  if (typeof window === 'undefined') return;
  if (!normKey) return;
  try {
    const cache = loadSearchCache();
    cache[normKey] = { posts, hasMore, timestamp: Date.now() };
    window.localStorage.setItem(SEARCH_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ถ้า localStorage ใช้งานไม่ได้ ให้ข้ามไปโดยไม่กระทบ logic หลัก
  }
}

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
    const normalizedSearchKey = normalizeCarSearch(trimmedSearch);

    setLoadingMore(true);
    const currentPage = isInitial ? 0 : (pageToFetch !== undefined ? pageToFetch : pageRef.current);
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = startIndex + PREFETCH_COUNT - 1; // endIndex is inclusive

    let postIds: string[] = [];
    let categoryModelNamesForFilter: string[] = [];

    // ถ้าเป็นการค้นคำใหม่รอบแรก และมีผลค้นหาใน cache แล้ว ให้แสดงผลเก่าทันทีระหว่างที่รอผลใหม่
    if (isInitial && trimmedSearch && normalizedSearchKey) {
      const cached = getCachedSearchResult(normalizedSearchKey);
      if (cached && Array.isArray(cached.posts) && cached.posts.length > 0) {
        setPosts(cached.posts);
        setHasMore(cached.hasMore);
      }
    }

    if (trimmedSearch) {
      // ค้นหาหมวดหมู่: ใช้ชื่อรุ่นจาก category-models ส่งให้ API (ตัดคำสั้น/ตัวเลขล้วนออกเพื่อลดโพสมั่ว)
      categoryModelNamesForFilter = getModelNamesFromCategory(trimmedSearch);
      let searchTerms = categoryModelNamesForFilter.length > 0
        ? (() => {
            const filtered = categoryModelNamesForFilter.filter((n) => {
              const t = normalizeCaptionSearch(String(n ?? '').trim());
              return t && !isTermTooNoisy(t);
            });
            return filtered.length > 0 ? filtered : categoryModelNamesForFilter;
          })()
        : (() => {
            const expanded = expandWithoutBrandAliases(trimmedSearch);
            const base = (expanded.length > 0 ? expanded : [trimmedSearch])
              .map((t) => String(t ?? '').trim())
              .filter(Boolean);
            return Array.from(new Set(base));
          })();
      // ลบคำซ้ำ ลดงานฝั่ง DB โดยไม่กระทบผลลัพธ์
      searchTerms = Array.from(new Set(searchTerms));
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
          // เช็กว่าเป็นการค้นหาหมวดหมู่หรือไม่ (ใช้ผลที่ cache ไว้จากตอนเรียก API)
          const categoryModelNames = categoryModelNamesForFilter;
          if (categoryModelNames.length > 0) {
            // Pre-normalize ชื่อรุ่นของหมวดนี้ครั้งเดียว — ใช้ใน single pass กรอง+คะแนน
            const categoryTermsNorm: string[] = [];
            for (const name of categoryModelNames) {
              const termNorm = normalizeCaptionSearch(String(name ?? '').trim());
              if (termNorm && !isTermTooNoisy(termNorm)) categoryTermsNorm.push(termNorm);
            }
            // Single pass:
            // - โพสที่มีคำตรงเป๊ะ (ขอบคำครบ) ในหมวดนั้น → ขึ้นบนสุด เรียงตามความยาวชื่อรุ่นที่ตรงที่สุด
            // - โพสที่มีคำใกล้เคียงแต่ไม่ตรงเป๊ะ → แสดงได้ แต่ให้ไปอยู่ล่างสุด
            const withScore: { post: any; score: number; exact: boolean }[] = [];
            for (const p of postsData) {
              const cap = normalizeCaptionSearch(p?.caption ?? '');
              if (!cap) continue;
              let maxLenExact = 0;
              let hasExact = false;
              let hasAny = false;
              for (const termNorm of categoryTermsNorm) {
                const idx = cap.indexOf(termNorm);
                if (idx === -1) continue;
                hasAny = true;
                if (hasWordBoundary(cap, termNorm, idx)) {
                  hasExact = true;
                  if (termNorm.length > maxLenExact) maxLenExact = termNorm.length;
                }
              }
              if (!hasAny) continue;
              withScore.push({ post: p, score: hasExact ? maxLenExact : 0, exact: hasExact });
            }
            orderedPostsData = withScore
              .sort((a, b) => {
                if (a.exact !== b.exact) return a.exact ? -1 : 1; // exact match มาก่อน near match
                return b.score - a.score;
              })
              .map((x) => x.post);
          } else {
            // ถ้าไม่ใช่หมวดหมู่: ใช้วิธีเดิม แต่เพิ่มกรณีค้นหายี่ห้อให้ใช้ระบบคะแนนเหมือนหมวด
            const expanded = expandWithoutBrandAliases(trimmedSearch);
            const searchTermsForFilter = (expanded.length > 0 ? expanded : [trimmedSearch])
              .map((t) => String(t ?? '').trim())
              .filter(Boolean);

            const isBrandSearch = BRAND_NAMES_SET.has(normalizeForFallback(trimmedSearch));

            if (isBrandSearch) {
              // แบรนด์: โพสที่มีชื่อยี่ห้อ (Toyota/โตโยต้า/ໂຕໂຢຕ້າ) ตรงที่สุดขึ้นก่อน
              // แล้วตามด้วยโพสที่มีแค่รุ่น/คำใกล้เคียง

              // หา brand เดียวกับคำค้น เพื่อดึงชื่อยี่ห้อทุกภาษา (ใช้จากแผนที่ที่เตรียมไว้)
              const qNorm = normalizeForFallback(trimmedSearch);
              const brandAliases: string[] = BRAND_ALIAS_MAP.get(qNorm) ?? [];

              const brandTermsNorm = brandAliases
                .map((name) => normalizeCaptionSearch(name))
                .filter(Boolean);

              const allTermsNorm: string[] = [];
              for (const term of searchTermsForFilter) {
                const n = normalizeCaptionSearch(term);
                if (n && !isTermTooNoisy(n)) allTermsNorm.push(n);
              }

              const brandSet = new Set(brandTermsNorm);
              const modelTermsNorm = allTermsNorm.filter((t) => !brandSet.has(t));

              const withScore: { post: any; score: number; group: number }[] = [];

              for (const p of postsData) {
                const cap = normalizeCaptionSearch(p?.caption ?? '');
                if (!cap) continue;

                let hasBrandExact = false;
                let hasBrandAny = false;
                let brandScoreLen = 0;

                for (const termNorm of brandTermsNorm) {
                  const idx = cap.indexOf(termNorm);
                  if (idx === -1) continue;
                  hasBrandAny = true;
                  if (hasWordBoundary(cap, termNorm, idx)) {
                    hasBrandExact = true;
                    if (termNorm.length > brandScoreLen) brandScoreLen = termNorm.length;
                  }
                }

                let hasModelExact = false;
                let hasModelAny = false;
                let modelScoreLen = 0;

                for (const termNorm of modelTermsNorm) {
                  const idx = cap.indexOf(termNorm);
                  if (idx === -1) continue;
                  hasModelAny = true;
                  if (hasWordBoundary(cap, termNorm, idx)) {
                    hasModelExact = true;
                    if (termNorm.length > modelScoreLen) modelScoreLen = termNorm.length;
                  }
                }

                if (!hasBrandAny && !hasModelAny) continue;

                let group = 3;
                let score = 0;

                if (hasBrandExact) {
                  group = 0; // ยี่ห้อตรงเป๊ะ: ขึ้นก่อนสุด
                  score = modelScoreLen > 0 ? modelScoreLen : brandScoreLen; // รุ่นที่ตรงยาวกว่าช่วยดันขึ้น
                } else if (hasModelExact) {
                  group = 1; // มีรุ่นตรงเป๊ะ แต่ไม่มีชื่อยี่ห้อแบบคำเต็ม
                  score = modelScoreLen;
                } else if (hasBrandAny) {
                  group = 2; // มียี่ห้อแบบใกล้เคียง (ไม่ขอบคำ)
                  score = brandScoreLen;
                } else {
                  group = 3; // มีแต่รุ่น/คำใกล้เคียง
                  score = modelScoreLen;
                }

                withScore.push({ post: p, score, group });
              }

              orderedPostsData = withScore
                .sort((a, b) => {
                  if (a.group !== b.group) return a.group - b.group; // group เล็กกว่ามาก่อน
                  return b.score - a.score;
                })
                .map((x) => x.post);
            } else {
              // คำค้นทั่วไป: ใช้การกรองเดิม
              orderedPostsData = postsData.filter((p: any) =>
                captionHasReasonableMatch(p?.caption ?? '', searchTermsForFilter)
              );
            }
          }
        } else {
          // กรณีไม่มีคำค้น (หน้า Home ปกติ): ถ้าเพิ่งโพสต์สำเร็จ ให้เลื่อนโพสต์นั้นขึ้นมาไว้บนสุดหนึ่งครั้ง
          if (typeof window !== 'undefined') {
            try {
              const justPostedId = window.localStorage.getItem('just_posted_post_id');
              if (justPostedId) {
                const idx = orderedPostsData.findIndex((p: any) => String(p.id) === justPostedId);
                if (idx > -1) {
                  const [justPost] = orderedPostsData.splice(idx, 1);
                  orderedPostsData.unshift(justPost);
                }
                window.localStorage.removeItem('just_posted_post_id');
              }
            } catch {
              // ถ้า localStorage ใช้งานไม่ได้ ให้ข้ามโดยไม่กระทบลำดับ algorithm เดิม
            }
          }
        }
        const stillCurrent = String(searchTermRef.current ?? '').normalize('NFKC').trim() === trimmedSearch;
        // เก็บผลค้นหาที่ผ่านการกรองแล้วลง cache เพื่อใช้ครั้งถัดไปให้แสดงทันที
        if (trimmedSearch && normalizedSearchKey) {
          saveSearchResultToCache(normalizedSearchKey, orderedPostsData, newHasMore);
        }
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
