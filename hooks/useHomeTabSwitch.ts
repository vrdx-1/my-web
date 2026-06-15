'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMainTabContext } from '@/contexts/MainTabContext';
import type { HomeTab } from './useHomeTabData';
import type { UseHomeFeedReturn } from './useHomeFeed';
import type { UseSearchPostsReturn } from './useSearchPosts';

const HOME_TAB_SCROLL_KEY_PREFIX = 'homeTabScrollY:';

function readHomeTabScroll(tab: HomeTab): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(`${HOME_TAB_SCROLL_KEY_PREFIX}${tab}`);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function writeHomeTabScroll(tab: HomeTab, y: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(y)) return;
  try {
    window.sessionStorage.setItem(`${HOME_TAB_SCROLL_KEY_PREFIX}${tab}`, String(Math.max(0, y)));
  } catch {
    // ignore
  }
}

function restoreHomeTabScrollWithRetry(targetY: number): void {
  if (typeof window === 'undefined') return;
  const isIOS = /iPad|iPhone|iPod/i.test(window.navigator.userAgent);
  const restore = (attempt = 0) => {
    window.scrollTo({ top: targetY, behavior: 'auto' });
    const currentY = window.scrollY;
    if (Math.abs(currentY - targetY) <= 4 || attempt >= 6) return;
    requestAnimationFrame(() => restore(attempt + 1));
  };

  requestAnimationFrame(() => restore(0));
  window.setTimeout(() => restore(0), isIOS ? 420 : 240);
}

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
      if (newTab === tab) {
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
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
        if (typeof window !== 'undefined') {
          writeHomeTabScroll(tab, window.scrollY);
        }
        mainTab?.setHomeTab(newTab);
        // Keep the current feed state when switching tabs.
        // We only refresh when user taps the currently active tab again.
        mainTab?.setNavigatingToTab(null);
        mainTab?.setTabRefreshing(false);
        setTabRefreshing(false);
        const targetY = readHomeTabScroll(newTab);
        restoreHomeTabScrollWithRetry(targetY);
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
