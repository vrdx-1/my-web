'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import type { HomeTab } from './useHomeTabData';
import type { UseHomeFeedReturn } from './useHomeFeed';
import type { UseSearchPostsReturn } from './useSearchPosts';

function resetHomeRefreshScrollTop() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

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
  const lastHandledRefreshRequestIdRef = useRef<number | null>(null);

  const doRefresh = useCallback(
    (refreshOptions?: { fromHomeButton?: boolean }) => {
      resetHomeRefreshScrollTop();
      homeProvince?.setSelectedProvince('');
      let useNormalFeed = !searchQuery.trim();
      if (refreshOptions?.fromHomeButton) {
        mainTab?.setHomeTab('recommend');
        if (searchParams.has('q')) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete('q');
          const queryString = params.toString();
          const newUrl = pathname + (queryString ? `?${queryString}` : '');
          window.history.replaceState(null, '', newUrl);
          router.replace(newUrl, { scroll: false });
          useNormalFeed = true;
        }
      }
      setTabRefreshing(true);
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
      router,
      searchParams,
      searchQuery,
      recommendFeed,
      searchData,
      homeProvince,
      soldTabRefreshRef,
      setTabRefreshing,
    ]
  );

  useEffect(() => {
    const request = mainTab?.tabRefreshRequest;
    if (!request) return;
    if (lastHandledRefreshRequestIdRef.current === request.requestId) return;
    lastHandledRefreshRequestIdRef.current = request.requestId;
    doRefresh(request.options);
    mainTab?.clearTabRefreshRequest();
  }, [mainTab, mainTab?.tabRefreshRequest, doRefresh]);

  return doRefresh;
}
