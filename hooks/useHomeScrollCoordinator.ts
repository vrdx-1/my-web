'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readMainTabScrollStorage, useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { useHomeTabScroll } from '@/contexts/HomeTabScrollContext';

const FORCE_SHOW_HEADER_EVENT = 'home:force-header-visible';

export interface UseHomeScrollCoordinatorOptions {
  pathname: string;
  clientMounted: boolean;
  firstFeedLoaded: boolean;
  showFeedSkeleton: boolean;
  activeTab: 'recommend' | 'sold';
  scrollStateKey: string;
  isSoldTabActive: boolean;
  tabRefreshing: boolean;
  hasSearch: boolean;
}

function buildTabStateScrollKey(tab: 'recommend' | 'sold', scrollStateKey: string): string {
  return `${tab}|${scrollStateKey}`;
}

function getPageScrollY(): number {
  if (typeof window === 'undefined') return 0;
  const scrolling = document.scrollingElement as HTMLElement | null;
  const bodyTop = document.body?.scrollTop ?? 0;
  const docTop = document.documentElement?.scrollTop ?? 0;
  const scrollingTop = scrolling?.scrollTop ?? 0;
  const winTop = window.scrollY ?? window.pageYOffset ?? 0;
  return Math.max(winTop, scrollingTop, bodyTop, docTop);
}

function setPageScrollY(y: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  const scrolling = document.scrollingElement as HTMLElement | null;
  if (scrolling) scrolling.scrollTop = y;
  if (document.body) document.body.scrollTop = y;
  if (document.documentElement) document.documentElement.scrollTop = y;
}

export function useHomeScrollCoordinator(options: UseHomeScrollCoordinatorOptions) {
  const {
    pathname,
    clientMounted,
    firstFeedLoaded,
    showFeedSkeleton,
    activeTab,
    scrollStateKey,
    isSoldTabActive,
    tabRefreshing,
    hasSearch,
  } = options;

  const homeTabScroll = useHomeTabScroll();
  const mainTabScroll = useMainTabScroll();
  const registerSaveBeforeSwitch = homeTabScroll?.registerSaveBeforeSwitch;
  const tabRefreshingRef = useRef(tabRefreshing);

  const tabStateScrollMapRef = useRef<Map<string, number>>(new Map());
  const prevShowSoldRef = useRef<boolean | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const prevTabStateScrollKeyRef = useRef<string | null>(null);
  const pendingHomeRouteScrollRestoreRef = useRef(false);
  const suppressHideUntilRef = useRef<number | null>(null);
  const [isChromeStartupLocked, setIsChromeStartupLocked] = useState(pathname === '/home');
  const chromeLockFrameRef = useRef<number | null>(null);

  useEffect(() => {
    tabRefreshingRef.current = tabRefreshing;
  }, [tabRefreshing]);

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
      options?.onSettled?.(getPageScrollY());
    };

    const run = () => {
      if (cancelled) return;
      setPageScrollY(targetY);
      attempts += 1;

      if (Math.abs(getPageScrollY() - targetY) <= 4 || attempts >= maxAttempts) {
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

  const scheduleChromeStartupLock = useCallback((locked: boolean) => {
    if (chromeLockFrameRef.current != null) {
      cancelAnimationFrame(chromeLockFrameRef.current);
    }

    chromeLockFrameRef.current = requestAnimationFrame(() => {
      chromeLockFrameRef.current = null;
      setIsChromeStartupLocked((prev) => (prev === locked ? prev : locked));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (chromeLockFrameRef.current != null) {
        cancelAnimationFrame(chromeLockFrameRef.current);
        chromeLockFrameRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev === '/home' && pathname !== '/home') {
      const activeStateKey = buildTabStateScrollKey(activeTab, scrollStateKey);
      tabStateScrollMapRef.current.set(activeStateKey, getPageScrollY());
      // iPhone/Safari บางจังหวะ reset scroll เร็วมากตอนเปลี่ยน route
      // บันทึกซ้ำตอน leave จาก /home เพื่อกันค่าหาย/กลายเป็น 0
      mainTabScroll?.saveCurrentScroll('/home');
    }
    if (pathname === '/home' && prev !== '/home' && prev != null) {
      pendingHomeRouteScrollRestoreRef.current = !hasSearch;
      scheduleChromeStartupLock(true);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 500;
    }
    if (pathname !== '/home') {
      pendingHomeRouteScrollRestoreRef.current = false;
      scheduleChromeStartupLock(false);
    }
  }, [pathname, hasSearch, scheduleChromeStartupLock, mainTabScroll, activeTab, scrollStateKey]);

  useLayoutEffect(() => {
    if (pathname !== '/home') return;

    const currentKey = buildTabStateScrollKey(activeTab, scrollStateKey);
    const previousKey = prevTabStateScrollKeyRef.current;

    if (!previousKey) {
      prevTabStateScrollKeyRef.current = currentKey;
      return;
    }

    if (previousKey === currentKey) return;

    tabStateScrollMapRef.current.set(previousKey, getPageScrollY());
    prevTabStateScrollKeyRef.current = currentKey;

    const targetY = tabStateScrollMapRef.current.get(currentKey) ?? 0;
    setPageScrollY(Math.max(0, targetY));
  }, [pathname, activeTab, scrollStateKey]);

  useEffect(() => {
    if (pathname !== '/home') return;
    if (!hasSearch) return;

    pendingHomeRouteScrollRestoreRef.current = false;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    suppressHideUntilRef.current = now + 300;
    scheduleChromeStartupLock(true);

    const showHeaderAfterReset = () => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event(FORCE_SHOW_HEADER_EVENT));
      });
    };

    const cancelRestore = restoreWindowScroll(0, {
      maxAttempts: 4,
      onSettled: () => {
        showHeaderAfterReset();
        scheduleChromeStartupLock(false);
        mainTabScroll?.saveCurrentScroll('/home');
      },
    });

    return () => {
      cancelRestore();
    };
  }, [pathname, hasSearch, mainTabScroll, scheduleChromeStartupLock]);

  useEffect(() => {
    if (pathname !== '/home') {
      scheduleChromeStartupLock(false);
      return;
    }

    if (!clientMounted || !firstFeedLoaded || showFeedSkeleton || pendingHomeRouteScrollRestoreRef.current) {
      scheduleChromeStartupLock(true);
      return;
    }

    scheduleChromeStartupLock(false);
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton, scheduleChromeStartupLock]);

  useEffect(() => {
    if (!registerSaveBeforeSwitch) return;
    registerSaveBeforeSwitch(() => {
      const y = typeof window !== 'undefined' ? getPageScrollY() : 0;
      const key = buildTabStateScrollKey(activeTab, scrollStateKey);
      tabStateScrollMapRef.current.set(key, y);
    });
    return () => {
      registerSaveBeforeSwitch(null);
    };
  }, [activeTab, scrollStateKey, registerSaveBeforeSwitch]);

  useLayoutEffect(() => {
    const showSold = isSoldTabActive;
    const prev = prevShowSoldRef.current;
    prevShowSoldRef.current = showSold;
    if (prev === null) return;
    if (prev === showSold) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    suppressHideUntilRef.current = now + 150;
    scheduleChromeStartupLock(true);

    const showHeaderAfterRestore = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event(FORCE_SHOW_HEADER_EVENT));
        });
      });
    };

    const targetTab: 'recommend' | 'sold' = showSold ? 'sold' : 'recommend';
    const targetStateKey = buildTabStateScrollKey(targetTab, scrollStateKey);
    const targetScrollY = tabStateScrollMapRef.current.get(targetStateKey) ?? 0;
    const normalizedTargetScrollY = Number.isFinite(targetScrollY)
      ? Math.max(0, targetScrollY)
      : 0;

    let settled = false;
    const cancelRestore = restoreWindowScroll(normalizedTargetScrollY, {
      maxAttempts: 4,
      onSettled: () => {
        settled = true;
        showHeaderAfterRestore();
        scheduleChromeStartupLock(false);
      },
    });

    return () => {
      cancelRestore();
      if (!settled) scheduleChromeStartupLock(false);
    };
  }, [isSoldTabActive, scrollStateKey, scheduleChromeStartupLock]);

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
      scheduleChromeStartupLock(false);
      return;
    }

    let cancelled = false;
    const useMask = targetY > 48;
    scheduleChromeStartupLock(true);

    const unmask = () => {
      const w = feedRestoreWrapRef.current;
      if (useMask && w) w.style.visibility = '';
    };

    // iOS Safari fallback: หลัง RAF chain เสร็จแล้ว Safari อาจยัง reset scroll — ตรวจซ้ำหลัง 350ms
    let iOSFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelRestore = restoreWindowScroll(targetY, {
      maxAttempts: 6,
      onSettled: (finalY) => {
        if (cancelled) return;

        if (Math.abs(finalY - targetY) > 4) {
          // ยังไม่ถึงจุด — iOS อาจ reset หลัง paint, retry ด้วย setTimeout
          iOSFallbackTimer = setTimeout(() => {
            if (cancelled) return;
            if (Math.abs(getPageScrollY() - targetY) > 4) {
              setPageScrollY(targetY);
            }
            unmask();
            pendingHomeRouteScrollRestoreRef.current = false;
            scheduleChromeStartupLock(false);
          }, 350);
          return;
        }

        unmask();
        pendingHomeRouteScrollRestoreRef.current = false;
        scheduleChromeStartupLock(false);
        mainTabScroll?.saveCurrentScroll('/home');
      },
    });

    return () => {
      cancelled = true;
      cancelRestore();
      if (iOSFallbackTimer != null) clearTimeout(iOSFallbackTimer);
      unmask();
    };
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton, mainTabScroll, isSoldTabActive, scheduleChromeStartupLock]);

  /** ป้องกัน suppressHideUntilRef ค้างตอนฟีดกำลังโหลด — reset timer เมื่อ tabRefreshing เข้ามา เพื่อให้ scroll hide สามารถทำงานได้ */
  useEffect(() => {
    if (!tabRefreshing || pathname !== '/home') return;
    suppressHideUntilRef.current = 0;
  }, [tabRefreshing, pathname]);

  return {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    suppressHideUntilRef,
    isChromeStartupLocked,
  };
}
