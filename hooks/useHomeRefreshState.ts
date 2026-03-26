'use client';

import { useEffect, useRef } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import type { HomeTab } from './useHomeTabData';

interface SoldListDataLike {
  posts: any[];
  loadingMore: boolean;
  setPage: (v: number | ((p: number) => number)) => void;
  setHasMore: (v: boolean) => void;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
}

export interface UseHomeRefreshStateOptions {
  tab: HomeTab;
  selectedProvince: string;
  soldListData: SoldListDataLike;
  effectiveLoadingMore: boolean;
  mainTab: ReturnType<typeof useMainTabContext> | null;
  setTabRefreshing: (v: boolean) => void;
}

export function useHomeRefreshState(options: UseHomeRefreshStateOptions) {
  const {
    tab,
    selectedProvince,
    soldListData,
    effectiveLoadingMore,
    mainTab,
    setTabRefreshing,
  } = options;

  const prevLoadingMoreRef = useRef(false);
  const soldTabRefreshRef = useRef<{
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    soldTabRefreshRef.current = {
      setPage: soldListData.setPage,
      setHasMore: soldListData.setHasMore,
      fetchPosts: soldListData.fetchPosts,
    };
    return () => {
      soldTabRefreshRef.current = null;
    };
  }, [soldListData.setPage, soldListData.setHasMore, soldListData.fetchPosts]);

  useEffect(() => {
    if (tab === 'sold' && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, soldListData.posts.length, soldListData.loadingMore, soldListData.setPage, soldListData.setHasMore, soldListData.fetchPosts]);

  useEffect(() => {
    if (tab !== 'sold') return;
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
  }, [tab, selectedProvince, soldListData.setPage, soldListData.setHasMore, soldListData.fetchPosts]);

  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = effectiveLoadingMore;
    if (wasLoading && !effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setTabRefreshing(false);
    } else if (!effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
    }
  }, [effectiveLoadingMore, mainTab, setTabRefreshing]);

  return { soldTabRefreshRef };
}
