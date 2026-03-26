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
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
  } | null>;
  setTabRefreshing: (v: boolean) => void;
  /** มีรายการขายแล้วโหลดไว้แล้ว — สลับมาแสดงทันที ไม่โหลดใหม่ */
  hasSoldTabCache?: boolean;
  /** มีรายการพร้อมขายโหลดไว้แล้ว — สลับกลับมาแสดงทันที ไม่โหลดใหม่ */
  hasRecommendTabCache?: boolean;
  /** มีผลค้นหาโหลดไว้แล้ว (กรณีมีคำค้น) — สลับกลับมาฝั่งพร้อมขายแสดงทันที ไม่โหลดใหม่ */
  hasSearchResultsCache?: boolean;
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
    hasSoldTabCache = false,
    hasRecommendTabCache = false,
    hasSearchResultsCache = false,
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
        if (newTab === 'sold' && hasSoldTabCache) {
          setTabRefreshing(false);
          mainTab?.setTabRefreshing(false);
        } else if (
          newTab === 'recommend' &&
          (searchQuery.trim() ? hasSearchResultsCache : hasRecommendTabCache)
        ) {
          // มี cache: ไม่มี search = แสดง feed พร้อมขายทันที, มี search = แสดงผลค้นหาทันที
          setTabRefreshing(false);
          mainTab?.setTabRefreshing(false);
        } else {
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
      }
    },
    [tab, mainTab, searchQuery, recommendFeed, searchData, soldTabRefreshRef, setTabRefreshing, hasSoldTabCache, hasRecommendTabCache, hasSearchResultsCache]
  );

  useEffect(() => {
    const request = mainTab?.tabChangeRequest;
    if (!request) return;
    if (lastHandledTabChangeRequestIdRef.current === request.requestId) return;
    lastHandledTabChangeRequestIdRef.current = request.requestId;
    setTabAndRefresh(request.tab);
  }, [mainTab?.tabChangeRequest, setTabAndRefresh]);

  return setTabAndRefresh;
}
