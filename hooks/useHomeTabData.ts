'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLikedSaved } from '@/hooks/useHomeLikedSaved';
import { useSearchPosts } from '@/hooks/useSearchPosts';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';

export type HomeTab = 'recommend' | 'sold';

/** Stub sold source เมื่อยังไม่เปิดแท็บขายแล้ว — ใช้ตอนมีคำค้น (sold จาก search) */
const SOLD_STUB = {
  posts: [] as any[],
  setPosts: (_: any) => {},
  session: undefined as any,
  likedPosts: {} as { [key: string]: boolean },
  savedPosts: {} as { [key: string]: boolean },
  setLikedPosts: (_: any) => {},
  setSavedPosts: (_: any) => {},
  loadingMore: false,
  hasMore: false,
  setPage: (_: any) => {},
  fetchPosts: (_?: boolean) => Promise.resolve(),
};

export type PostListSource = typeof SOLD_STUB;

export interface UseHomeTabDataOptions {
  session: any;
  sessionReady: boolean;
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
  posts: any[];
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
  const { session, sessionReady, startSessionCheck, setFirstFeedLoaded } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') ?? '';
  const hadSearchRef = useRef(false);

  const mainTab = useMainTabContext();
  const tab = mainTab?.homeTab ?? 'recommend';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';

  const sharedLikedSaved = useHomeLikedSaved(session, sessionReady);

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
    sessionReady,
    province: selectedProvince,
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
    session,
    sessionReady,
    sharedLikedSaved,
    enabled: searchQuery.trim().length > 0,
  });

  const hasSearch = searchQuery.trim().length > 0;

  const recommendSource: PostListSource = hasSearch
    ? {
        posts: searchData.posts.filter((p: any) => p.status === 'recommend'),
        setPosts: (fn: any) => {
          searchData.setPosts((prev: any[]) => {
            const recommendOnly = prev.filter((p: any) => p.status === 'recommend');
            const next = typeof fn === 'function' ? fn(recommendOnly) : fn;
            if (!Array.isArray(next)) return prev;
            const byId = new Map(next.map((p: any) => [p.id, p]));
            const nextIds = new Set(next.map((p: any) => p.id));
            return prev
              .filter((p: any) => p.status !== 'recommend' || nextIds.has(p.id))
              .map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
          });
        },
        session: searchData.session,
        likedPosts: searchData.likedPosts,
        savedPosts: searchData.savedPosts,
        setLikedPosts: searchData.setLikedPosts,
        setSavedPosts: searchData.setSavedPosts,
        loadingMore: searchData.loading,
        hasMore: false,
        setPage: () => {},
        fetchPosts: () => searchData.fetchSearch(),
      }
    : recommendFeed;

  const soldSource: PostListSource = hasSearch
    ? {
        posts: searchData.posts.filter((p: any) => p.status === 'sold'),
        setPosts: (fn: any) => {
          searchData.setPosts((prev: any[]) => {
            const soldOnly = prev.filter((p: any) => p.status === 'sold');
            const next = typeof fn === 'function' ? fn(soldOnly) : fn;
            if (!Array.isArray(next)) return prev;
            const byId = new Map(next.map((p: any) => [p.id, p]));
            const nextIds = new Set(next.map((p: any) => p.id));
            return prev
              .filter((p: any) => p.status !== 'sold' || nextIds.has(p.id))
              .map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
          });
        },
        session: searchData.session,
        likedPosts: searchData.likedPosts,
        savedPosts: searchData.savedPosts,
        setLikedPosts: searchData.setLikedPosts,
        setSavedPosts: searchData.setSavedPosts,
        loadingMore: searchData.loading,
        hasMore: false,
        setPage: () => {},
        fetchPosts: () => searchData.fetchSearch(),
      }
    : SOLD_STUB;

  const isSoldTabNoSearch = tab === 'sold' && !hasSearch;
  const posts =
    tab === 'recommend'
      ? recommendSource.posts
      : isSoldTabNoSearch
        ? [] // soldTabPosts จะถูก set จาก SoldTabFeedWrapper ที่ parent
        : soldSource.posts;
  const postList =
    tab === 'recommend' ? recommendSource : isSoldTabNoSearch ? SOLD_STUB : soldSource;

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
