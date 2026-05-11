'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import type { HomeTab } from './useHomeTabData';
import type { UseHomeFeedReturn } from './useHomeFeed';
import type { UseSearchPostsReturn } from './useSearchPosts';

export interface UseHomeTabSwitchOptions {
  tab: HomeTab;
  mainTab: ReturnType<typeof useMainTabContext> | null;
  searchQuery: string;
  recommendFeed: UseHomeFeedReturn;
  searchData: UseSearchPostsReturn;
  soldTabRefreshRef: React.MutableRefObject<{
    setPosts: React.Dispatch<React.SetStateAction<unknown[]>>;
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
    refreshData: () => Promise<void>;
  } | null>;
  setTabRefreshing: (v: boolean) => void;
}

export function useHomeTabSwitch(options: UseHomeTabSwitchOptions) {
  const {
    tab,
    mainTab,
    searchQuery,
    recommendFeed,
    searchData,
    soldTabRefreshRef,
    setTabRefreshing,
  } = options;
  const lastHandledTabChangeRequestIdRef = useRef<number | null>(null);

  const setTabAndRefresh = useCallback(
    (newTab: HomeTab) => {
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
      if (newTab === tab) {
        mainTab?.setTabRefreshing(true);
        setTabRefreshing(true);
        if (newTab === 'recommend') {
          if (searchQuery.trim()) {
            searchData.fetchSearch();
          } else {
            recommendFeed.refreshData();
          }
        } else {
          soldTabRefreshRef.current?.refreshData?.();
        }
      } else {
        mainTab?.setNavigatingToTab(newTab);
        mainTab?.setHomeTab(newTab);
        mainTab?.setTabRefreshing(true);
        setTabRefreshing(true);

        if (newTab === 'recommend') {
          if (searchQuery.trim()) {
            searchData.fetchSearch();
          } else {
            recommendFeed.setPosts([]);
            recommendFeed.setPage(0);
            recommendFeed.setHasMore(true);
            recommendFeed.fetchPosts(true);
          }
        } else {
          soldTabRefreshRef.current?.setPosts([]);
          soldTabRefreshRef.current?.setPage(0);
          soldTabRefreshRef.current?.setHasMore(true);
          soldTabRefreshRef.current?.fetchPosts(true);
        }
      }
    },
    [tab, mainTab, searchQuery, recommendFeed, searchData, soldTabRefreshRef, setTabRefreshing]
  );

  useEffect(() => {
    const request = mainTab?.tabChangeRequest;
    if (!request) return;
    if (lastHandledTabChangeRequestIdRef.current === request.requestId) return;
    lastHandledTabChangeRequestIdRef.current = request.requestId;
    setTabAndRefresh(request.tab);
    mainTab?.clearTabChangeRequest();
  }, [mainTab, mainTab?.tabChangeRequest, setTabAndRefresh]);

  return setTabAndRefresh;
}
