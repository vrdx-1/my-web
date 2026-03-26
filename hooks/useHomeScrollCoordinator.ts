'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { readMainTabScrollStorage, useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { useHomeTabScroll } from '@/contexts/HomeTabScrollContext';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';

export interface UseHomeScrollCoordinatorOptions {
  pathname: string;
  clientMounted: boolean;
  firstFeedLoaded: boolean;
  showFeedSkeleton: boolean;
  isSoldTabNoSearch: boolean;
}

export function useHomeScrollCoordinator(options: UseHomeScrollCoordinatorOptions) {
  const { pathname, clientMounted, firstFeedLoaded, showFeedSkeleton, isSoldTabNoSearch } = options;

  const homeTabScroll = useHomeTabScroll();
  const mainTabScroll = useMainTabScroll();
  const headerVisibility = useHeaderVisibilityContext();

  const recommendScrollRef = useRef(0);
  const soldScrollRef = useRef(0);
  const prevShowSoldRef = useRef<boolean | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const pendingHomeRouteScrollRestoreRef = useRef(false);
  const suppressHideUntilRef = useRef<number | null>(null);

  const feedRestoreWrapRef = useRef<HTMLDivElement | null>(null);
  const recommendPanelRef = useRef<HTMLDivElement | null>(null);
  const soldPanelRef = useRef<HTMLDivElement | null>(null);

  const setHeaderVisibleRef = useRef(headerVisibility?.snapHeaderVisible ?? headerVisibility?.setHeaderVisible);
  setHeaderVisibleRef.current = headerVisibility?.snapHeaderVisible ?? headerVisibility?.setHeaderVisible;

  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname === '/home' && prev !== '/home' && prev != null) {
      pendingHomeRouteScrollRestoreRef.current = true;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 500;
      headerVisibility?.snapHeaderVisible?.(true) ?? headerVisibility?.setHeaderVisible(true);
    }
    if (pathname !== '/home') {
      pendingHomeRouteScrollRestoreRef.current = false;
    }
  }, [pathname, headerVisibility]);

  useEffect(() => {
    if (!homeTabScroll?.saveBeforeSwitchRef) return;
    homeTabScroll.saveBeforeSwitchRef.current = () => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      if (isSoldTabNoSearch) soldScrollRef.current = y;
      else recommendScrollRef.current = y;
    };
    return () => {
      homeTabScroll.saveBeforeSwitchRef.current = null;
    };
  }, [homeTabScroll, isSoldTabNoSearch]);

  useLayoutEffect(() => {
    const showSold = isSoldTabNoSearch;
    const prev = prevShowSoldRef.current;
    prevShowSoldRef.current = showSold;
    if (prev === null) return;
    if (prev === showSold) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    suppressHideUntilRef.current = now + 400;
    const toRestore = showSold ? soldScrollRef.current : recommendScrollRef.current;
    const activePanelRef = showSold ? soldPanelRef : recommendPanelRef;

    const showHeaderAfterRestore = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeaderVisibleRef.current?.(true));
      });
    };

    if (typeof window === 'undefined' || !Number.isFinite(toRestore)) {
      showHeaderAfterRestore();
      return;
    }

    const targetY = toRestore;
    let attempts = 0;
    const maxAttempts = 25;
    const tryScroll = () => {
      const el = activePanelRef.current;
      if (el) void el.offsetHeight;
      window.scrollTo(0, targetY);
      attempts += 1;
      const current = window.scrollY;
      const diff = Math.abs(current - targetY);
      if (diff > 2 && attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        showHeaderAfterRestore();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(tryScroll));
  }, [isSoldTabNoSearch]);

  useLayoutEffect(() => {
    if (pathname !== '/home') {
      const w = feedRestoreWrapRef.current;
      if (w) w.style.visibility = '';
      return;
    }
    if (!pendingHomeRouteScrollRestoreRef.current) return;
    if (!clientMounted) return;
    if (!firstFeedLoaded) return;
    if (showFeedSkeleton) return;
    const targetY = readMainTabScrollStorage('/home');
    if (typeof targetY !== 'number' || !Number.isFinite(targetY)) return;
    const wrap = feedRestoreWrapRef.current;
    if (targetY > 48 && wrap) wrap.style.visibility = 'hidden';
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton]);

  useEffect(() => {
    if (pathname !== '/home') return;
    if (!pendingHomeRouteScrollRestoreRef.current) return;
    if (!clientMounted) return;
    if (!firstFeedLoaded) return;
    if (showFeedSkeleton) return;

    const targetY = readMainTabScrollStorage('/home');
    if (typeof targetY !== 'number' || !Number.isFinite(targetY)) {
      pendingHomeRouteScrollRestoreRef.current = false;
      return;
    }

    let cancelled = false;
    const useMask = targetY > 48;
    const activePanelRef = isSoldTabNoSearch ? soldPanelRef : recommendPanelRef;

    const unmask = () => {
      const w = feedRestoreWrapRef.current;
      if (useMask && w) w.style.visibility = '';
    };

    let attempts = 0;
    const maxAttempts = 40;
    const tryScroll = () => {
      if (cancelled) return;
      const el = activePanelRef.current;
      if (el) void el.offsetHeight;
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
      attempts += 1;
      const current = window.scrollY;
      const diff = Math.abs(current - targetY);
      if (diff > 3 && attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        unmask();
        pendingHomeRouteScrollRestoreRef.current = false;
        if (diff <= 4) {
          mainTabScroll?.saveCurrentScroll('/home');
        }
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(tryScroll);
    });

    return () => {
      cancelled = true;
      unmask();
    };
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton, mainTabScroll, isSoldTabNoSearch]);

  return {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    suppressHideUntilRef,
  };
}
