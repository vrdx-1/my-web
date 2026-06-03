'use client';

import { useEffect, useRef } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import type { HomeTab } from './useHomeTabData';

interface SoldListDataLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posts: any[];
  loadingMore: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  setPage: (v: number | ((p: number) => number)) => void;
  setHasMore: (v: boolean) => void;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface UseHomeRefreshStateOptions {
  tab: HomeTab;
  selectedProvince: string;
  minPriceKip: number | null;
  maxPriceKip: number | null;
  priceSortOrder: '' | 'asc' | 'desc';
  soldListData: SoldListDataLike;
  effectiveLoadingMore: boolean;
  mainTab: ReturnType<typeof useMainTabContext> | null;
  setTabRefreshing: (v: boolean) => void;
}

export function useHomeRefreshState(options: UseHomeRefreshStateOptions) {
  const {
    tab,
    selectedProvince,
    minPriceKip,
    maxPriceKip,
    priceSortOrder,
    soldListData,
    effectiveLoadingMore,
    mainTab,
    setTabRefreshing,
  } = options;

  const prevLoadingMoreRef = useRef(false);
  const prevTabRef = useRef<HomeTab>(tab);
  const prevProvinceRef = useRef(selectedProvince);
  const prevMinPriceRef = useRef(minPriceKip);
  const prevMaxPriceRef = useRef(maxPriceKip);
  const prevPriceSortOrderRef = useRef(priceSortOrder);
  const soldTabRefreshRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPosts: React.Dispatch<React.SetStateAction<any[]>>;
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
    refreshData: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    soldTabRefreshRef.current = {
      setPosts: soldListData.setPosts,
      setPage: soldListData.setPage,
      setHasMore: soldListData.setHasMore,
      fetchPosts: soldListData.fetchPosts,
      refreshData: soldListData.refreshData,
    };
    return () => {
      soldTabRefreshRef.current = null;
    };
  }, [soldListData.setPosts, soldListData.setPage, soldListData.setHasMore, soldListData.fetchPosts, soldListData.refreshData]);

  useEffect(() => {
    const previousTab = prevTabRef.current;
    const previousProvince = prevProvinceRef.current;
    const previousMinPrice = prevMinPriceRef.current;
    const previousMaxPrice = prevMaxPriceRef.current;
    const previousPriceSortOrder = prevPriceSortOrderRef.current;
    const enteredSoldTab = tab === 'sold' && previousTab !== 'sold';
    const provinceChanged = previousProvince !== selectedProvince;
    const priceChanged = previousMinPrice !== minPriceKip || previousMaxPrice !== maxPriceKip;
    const sortChanged = previousPriceSortOrder !== priceSortOrder;

    prevTabRef.current = tab;
    prevProvinceRef.current = selectedProvince;
    prevMinPriceRef.current = minPriceKip;
    prevMaxPriceRef.current = maxPriceKip;
    prevPriceSortOrderRef.current = priceSortOrder;

    if (tab !== 'sold') return;

    if (enteredSoldTab) {
      if (soldListData.posts.length === 0 && !soldListData.loadingMore) {
        soldListData.setPage(0);
        soldListData.setHasMore(true);
        soldListData.fetchPosts(true);
      }
      return;
    }

    if (provinceChanged || priceChanged || sortChanged) {
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [
    tab,
    selectedProvince,
    minPriceKip,
    maxPriceKip,
    priceSortOrder,
    soldListData,
  ]);

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
