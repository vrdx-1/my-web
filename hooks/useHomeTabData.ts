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
import { getPrimaryGuestToken } from '@/utils/postUtils';

export type HomeTab = 'recommend' | 'sold';

export type PostListSource = HomePostListSource;

export interface UseHomeTabDataOptions {
  session: Session | null;
  sessionReady: boolean;
  activeProfileId?: string | null;
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
  const { session, sessionReady, activeProfileId, startSessionCheck, setFirstFeedLoaded } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') ?? '';
  const hadSearchRef = useRef(false);

  const mainTab = useMainTabContext();
  const tab = mainTab?.homeTab ?? 'recommend';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';

  const sharedLikedSaved = useHomeLikedSaved(session, sessionReady, activeProfileId);

  useEffect(() => {
    const hasSearch = searchQuery.trim().length > 0;
    if (hasSearch && !hadSearchRef.current) {
      hadSearchRef.current = true;
      mainTab?.setHomeTab('recommend');
    }
    if (!hasSearch) hadSearchRef.current = false;
  }, [searchQuery, mainTab]);

  // ✅ หากเซสชั่นพร้อมแล้วและเป็นผู้ใช้จริง ให้บันทึกการเข้าชมครั้งนี้เป็น user (ตรวจสอบสถานะเซสชั่นที่เปลี่ยนแปลง)
  const sessionCheckRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!sessionReady) return;
    if (!session?.user?.id) return;
    const key = `tracked-${session.user.id}`;
    if (sessionCheckRef.current.has(key)) return;
    sessionCheckRef.current.set(key, true);

    // บันทึกการเข้าชมเป็น user เมื่อเซสชั่นพร้อมแล้ว
    void fetch('/api/analytics/daily-visitor', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {
      // ignore analytics failures
    });
  }, [sessionReady, session?.user?.id]);

  const recommendFeed = useHomeFeed({
    session,
    sessionReady,
    province: selectedProvince,
    onInitialLoadDone: () => {
      startSessionCheck();
      setFirstFeedLoaded(true);
      // ยิงหลังฟีดพร้อมแล้วเท่านั้น เพื่อลดผลกระทบกับความเร็วหน้าโฮม
      // ✅ ตรวจสอบ sessionReady ให้แน่ใจว่า session พร้อมก่อนส่ง — ถ้า sessionReady=false ให้ส่งเป็น guest ไปก่อน
      const payload = sessionReady && session?.user?.id ? {} : { guestToken: getPrimaryGuestToken() };
      void fetch('/api/analytics/daily-visitor', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // ignore analytics failures
      });
    },
    sharedLikedSaved,
    isActive: pathname === '/home',
  });

  const searchData = useSearchPosts({
    query: searchQuery,
    province: selectedProvince,
    session,
    activeProfileId,
    sessionReady,
    sharedLikedSaved,
    enabled: searchQuery.trim().length > 0,
  });

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
