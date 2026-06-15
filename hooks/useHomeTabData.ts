'use client';

import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLikedSaved } from '@/hooks/useHomeLikedSaved';
import { useSearchPosts } from '@/hooks/useSearchPosts';
import { useHomeSearchResultSources, HOME_SOLD_STUB, type HomePostListSource } from '@/hooks/useHomeSearchResultSources';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import { readSoldFeedCache, writeSoldFeedCache } from '@/hooks/homeFeedStorage';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';

export type HomeTab = 'recommend' | 'sold';

export type PostListSource = HomePostListSource;

export interface UseHomeTabDataOptions {
  session: Session | null;
  sessionReady: boolean;
  activeProfileId?: string | null;
  authUserId?: string | null;
  startSessionCheck: () => void;
  setFirstFeedLoaded: (v: boolean) => void;
}

export interface UseHomeTabDataReturn {
  sharedLikedSaved: ReturnType<typeof useHomeLikedSaved>;
  recommendFeed: ReturnType<typeof useHomeFeed>;
  searchData: ReturnType<typeof useSearchPosts>;
  hasSearch: boolean;
  recommendSource: PostListSource;
  soldSource: PostListSource;
  isSoldTabNoSearch: boolean;
  posts: unknown[];
  postList: PostListSource;
  searchQuery: string;
  tab: HomeTab;
  mainTab: ReturnType<typeof useMainTabContext>;
  homeProvince: ReturnType<typeof useHomeProvince>;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}

export function useHomeTabData(options: UseHomeTabDataOptions): UseHomeTabDataReturn {
  const { session, sessionReady, activeProfileId, authUserId, startSessionCheck, setFirstFeedLoaded } = options;
  const { firstFeedLoaded } = useFirstFeedLoaded();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') ?? '';
  const hadSearchRef = useRef(false);

  const mainTab = useMainTabContext();
  const tab = mainTab?.homeTab ?? 'recommend';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const minPriceKip = homeProvince?.minPriceKip ?? null;
  const maxPriceKip = homeProvince?.maxPriceKip ?? null;
  const minPriceDisplay = homeProvince?.minPriceDisplay ?? null;
  const maxPriceDisplay = homeProvince?.maxPriceDisplay ?? null;
  const displayCurrency = homeProvince?.displayCurrency ?? '₭';
  const priceSortOrder = homeProvince?.priceSortOrder ?? '';

  const sharedLikedSaved = useHomeLikedSaved(session, sessionReady, activeProfileId);

  useEffect(() => {
    const hasSearch = searchQuery.trim().length > 0;
    if (hasSearch && !hadSearchRef.current) {
      hadSearchRef.current = true;
      mainTab?.setHomeTab('recommend');
    }
    if (!hasSearch) hadSearchRef.current = false;
  }, [searchQuery, mainTab]);

  const recommendFeed = useHomeFeed({
    session,
    activeProfileId,
    authUserId,
    sessionReady,
    province: selectedProvince,
    minPriceKip,
    maxPriceKip,
    minPriceDisplay,
    maxPriceDisplay,
    displayCurrency,
    priceSortOrder,
    onInitialLoadDone: () => {
      startSessionCheck();
      setFirstFeedLoaded(true);
    },
    sharedLikedSaved,
    isActive: pathname === '/home',
  });

  const searchData = useSearchPosts({
    query: searchQuery,
    province: selectedProvince,
    minPriceKip,
    maxPriceKip,
    minPriceDisplay,
    maxPriceDisplay,
    displayCurrency,
    priceSortOrder,
    session,
    activeProfileId,
    sessionReady,
    sharedLikedSaved,
    enabled: searchQuery.trim().length > 0,
  });

  // Prefetch sold feed ใน background หลัง recommend โหลดครั้งแรกเสร็จ
  // เพื่อให้เมื่อ user สลับมา sold tab จะเห็น content ทันที (hit localStorage cache)
  const soldPrefetchedRef = useRef(false);
  const recommendInitialDoneRef = useRef(false);

  // ฟัง event ที่ onInitialLoadDone ยิงผ่าน setFirstFeedLoaded เพื่อ trigger prefetch
  useEffect(() => {
    if (recommendInitialDoneRef.current) return;
    if (soldPrefetchedRef.current) return;
    // รอ firstFeedLoaded จาก context
    if (!firstFeedLoaded) return;
    recommendInitialDoneRef.current = true;
    // ข้ามถ้ามี price filter
    const hasPriceMode = !!(minPriceKip != null || maxPriceKip != null || minPriceDisplay != null || maxPriceDisplay != null || priceSortOrder);
    if (hasPriceMode) return;
    // ข้ามถ้า localStorage cache ยังใช้ได้อยู่
    if (readSoldFeedCache(selectedProvince)) return;
    soldPrefetchedRef.current = true;
    // fire-and-forget: fetch sold feed และเขียน localStorage cache
    const body: Record<string, unknown> = {
      status: 'sold',
      startIndex: 0,
      endIndex: 4,
    };
    if (selectedProvince.trim()) body.province = selectedProvince.trim();
    fetch('/api/posts/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((payload) => {
        if (!payload || !Array.isArray(payload.posts) || payload.posts.length === 0) return;
        writeSoldFeedCache(selectedProvince, payload.posts, !!payload.hasMore);
      })
      .catch(() => {});
  }, [firstFeedLoaded, selectedProvince, minPriceKip, maxPriceKip, minPriceDisplay, maxPriceDisplay, priceSortOrder]);

  const hasSearch = searchQuery.trim().length > 0;

  const { recommendSource, soldSource } = useHomeSearchResultSources({
    hasSearch,
    searchQuery,
    searchData,
    recommendFeed,
  });

  const isSoldTabNoSearch = tab === 'sold' && !hasSearch;
  const posts =
    tab === 'recommend'
      ? recommendSource.posts
      : isSoldTabNoSearch
        ? [] // soldTabPosts จะถูก set จาก SoldTabFeedWrapper ที่ parent
        : soldSource.posts;
  const postList =
    tab === 'recommend' ? recommendSource : isSoldTabNoSearch ? HOME_SOLD_STUB : soldSource;

  return {
    sharedLikedSaved,
    recommendFeed,
    searchData,
    hasSearch,
    recommendSource,
    soldSource,
    isSoldTabNoSearch,
    posts,
    postList,
    searchQuery,
    tab,
    mainTab,
    homeProvince,
    pathname,
    router,
    searchParams,
  };
}
