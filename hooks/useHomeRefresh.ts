'use client';

import { useCallback, useEffect } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import type { HomeTab } from './useHomeTabData';
import type { UseHomeFeedReturn } from './useHomeFeed';
import type { UseSearchPostsReturn } from './useSearchPosts';

export interface UseHomeRefreshOptions {
  tab: HomeTab;
  mainTab: ReturnType<typeof useMainTabContext> | null;
  pathname: string;
  router: ReturnType<typeof import('next/navigation').useRouter>;
  searchParams: ReturnType<typeof import('next/navigation').useSearchParams>;
  homeProvince: ReturnType<typeof useHomeProvince> | null;
  recommendFeed: UseHomeFeedReturn;
  searchData: UseSearchPostsReturn;
  searchQuery: string;
  soldTabRefreshRef: React.MutableRefObject<{
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
  } | null>;
  setTabRefreshing: (v: boolean) => void;
}

export function useHomeRefresh(options: UseHomeRefreshOptions) {
  const {
    tab,
    mainTab,
    pathname,
    router,
    searchParams,
    homeProvince,
    recommendFeed,
    searchData,
    searchQuery,
    soldTabRefreshRef,
    setTabRefreshing,
  } = options;

  const doRefresh = useCallback(
    (refreshOptions?: { fromHomeButton?: boolean }) => {
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
      homeProvince?.setSelectedProvince('');
      const clearedSearch = searchParams.has('q');
      if (clearedSearch) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('q');
        const queryString = params.toString();
        const newUrl = pathname + (queryString ? `?${queryString}` : '');
        window.history.replaceState(null, '', newUrl);
        router.replace(newUrl, { scroll: false });
      }
      if (refreshOptions?.fromHomeButton) {
        mainTab?.setHomeTab('recommend');
      }
      setTabRefreshing(true);
      const useNormalFeed = clearedSearch || !searchQuery.trim();
      const effectiveTab = refreshOptions?.fromHomeButton ? 'recommend' : tab;
      if (effectiveTab === 'recommend') {
        if (useNormalFeed) {
          recommendFeed.setPage(0);
          recommendFeed.setHasMore(true);
          recommendFeed.fetchPosts(true);
        } else {
          searchData.fetchSearch();
        }
      } else {
        if (useNormalFeed) {
          soldTabRefreshRef.current?.setPage(0);
          soldTabRefreshRef.current?.setHasMore(true);
          soldTabRefreshRef.current?.fetchPosts(true);
        } else {
          searchData.fetchSearch();
        }
      }
    },
    [
      tab,
      mainTab,
      pathname,
      recommendFeed,
      searchData,
      searchQuery,
      searchParams,
      router,
      homeProvince,
      soldTabRefreshRef,
      setTabRefreshing,
    ]
  );

  useEffect(() => {
    mainTab?.registerTabRefreshHandler(doRefresh);
    return () => mainTab?.unregisterTabRefreshHandler();
  }, [mainTab, doRefresh]);

  return doRefresh;
}
