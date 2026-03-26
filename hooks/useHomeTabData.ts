'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLikedSaved } from '@/hooks/useHomeLikedSaved';
import { useSearchPosts } from '@/hooks/useSearchPosts';
import { useHomeSearchResultSources, HOME_SOLD_STUB, type HomePostListSource } from '@/hooks/useHomeSearchResultSources';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';

export type HomeTab = 'recommend' | 'sold';

export type PostListSource = HomePostListSource;

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
