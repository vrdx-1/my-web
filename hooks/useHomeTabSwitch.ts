'use client';

import { useCallback, useEffect } from 'react';
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
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
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
            recommendFeed.setPage(0);
            recommendFeed.setHasMore(true);
            recommendFeed.fetchPosts(true);
          }
        } else {
          soldTabRefreshRef.current?.setPage(0);
          soldTabRefreshRef.current?.setHasMore(true);
          soldTabRefreshRef.current?.fetchPosts(true);
        }
      } else {
        mainTab?.setNavigatingToTab(newTab);
        mainTab?.setHomeTab(newTab);
        setTabRefreshing(true);
        if (newTab === 'recommend') {
          if (searchQuery.trim()) {
            searchData.fetchSearch();
          } else {
            recommendFeed.setPage(0);
            recommendFeed.setHasMore(true);
            recommendFeed.fetchPosts(true);
          }
        }
      }
    },
    [tab, mainTab, searchQuery, recommendFeed, searchData, soldTabRefreshRef, setTabRefreshing]
  );

  useEffect(() => {
    mainTab?.registerTabChangeHandler(setTabAndRefresh);
    return () => mainTab?.unregisterTabChangeHandler();
  }, [mainTab, setTabAndRefresh]);

  return setTabAndRefresh;
}
