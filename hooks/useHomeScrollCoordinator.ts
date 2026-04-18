'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { readMainTabScrollStorage, useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { useHomeTabScroll } from '@/contexts/HomeTabScrollContext';
import { useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';

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
  const registerSaveBeforeSwitch = homeTabScroll?.registerSaveBeforeSwitch;
  const setHeaderVisible = useSetHeaderVisibility();

  const recommendScrollRef = useRef(0);
  const soldScrollRef = useRef(0);
  const prevShowSoldRef = useRef<boolean | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const pendingHomeRouteScrollRestoreRef = useRef(false);
  const suppressHideUntilRef = useRef<number | null>(null);

  const feedRestoreWrapRef = useRef<HTMLDivElement | null>(null);
  const recommendPanelRef = useRef<HTMLDivElement | null>(null);
  const soldPanelRef = useRef<HTMLDivElement | null>(null);

  const restoreWindowScroll = (
    targetY: number,
    options?: {
      maxAttempts?: number;
      onSettled?: (finalY: number) => void;
    },
  ) => {
    if (typeof window === 'undefined' || !Number.isFinite(targetY)) {
      options?.onSettled?.(0);
      return () => {};
    }

    let cancelled = false;
    const rafIds: number[] = [];
    let attempts = 0;
    const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);

    const finish = () => {
      if (cancelled) return;
      options?.onSettled?.(window.scrollY);
    };

    const run = () => {
      if (cancelled) return;
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
      attempts += 1;

      if (Math.abs(window.scrollY - targetY) <= 4 || attempts >= maxAttempts) {
        const settleId = requestAnimationFrame(finish);
        rafIds.push(settleId);
        return;
      }

      const retryId = requestAnimationFrame(run);
      rafIds.push(retryId);
    };

    const startId = requestAnimationFrame(() => {
      const verifyId = requestAnimationFrame(run);
      rafIds.push(verifyId);
    });
    rafIds.push(startId);

    return () => {
      cancelled = true;
      rafIds.forEach((id) => cancelAnimationFrame(id));
    };
  };

  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname === '/home' && prev !== '/home' && prev != null) {
      pendingHomeRouteScrollRestoreRef.current = true;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 500;
    }
    if (pathname !== '/home') {
      pendingHomeRouteScrollRestoreRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (!registerSaveBeforeSwitch) return;
    registerSaveBeforeSwitch(() => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      if (isSoldTabNoSearch) soldScrollRef.current = y;
      else recommendScrollRef.current = y;
    });
    return () => {
      registerSaveBeforeSwitch(null);
    };
  }, [isSoldTabNoSearch, registerSaveBeforeSwitch]);

  useLayoutEffect(() => {
    const showSold = isSoldTabNoSearch;
    const prev = prevShowSoldRef.current;
    prevShowSoldRef.current = showSold;
    if (prev === null) return;
    if (prev === showSold) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    suppressHideUntilRef.current = now + 400;
    const toRestore = showSold ? soldScrollRef.current : recommendScrollRef.current;

    const showHeaderAfterRestore = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeaderVisible?.(true));
      });
    };

    if (typeof window === 'undefined' || !Number.isFinite(toRestore)) {
      showHeaderAfterRestore();
      return;
    }

    return restoreWindowScroll(toRestore, {
      maxAttempts: 4,
      onSettled: () => {
        showHeaderAfterRestore();
      },
    });
  }, [isSoldTabNoSearch, setHeaderVisible]);

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

    const unmask = () => {
      const w = feedRestoreWrapRef.current;
      if (useMask && w) w.style.visibility = '';
    };

    const cancelRestore = restoreWindowScroll(targetY, {
      maxAttempts: 5,
      onSettled: (finalY) => {
        if (cancelled) return;
        unmask();
        pendingHomeRouteScrollRestoreRef.current = false;
        if (Math.abs(finalY - targetY) <= 4) {
          mainTabScroll?.saveCurrentScroll('/home');
        }
      },
    });

    return () => {
      cancelled = true;
      cancelRestore();
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
