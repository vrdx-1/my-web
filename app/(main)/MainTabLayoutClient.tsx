'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { useHeaderVisibilityState, useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';
import { ProfileOverlay } from '@/components/ProfileOverlay';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { FULLSCREEN_VIEWER_ROOT_SELECTOR } from '@/utils/fullScreenMode';
import { markRouteVisited } from '@/utils/visitedRoutesStore';
import { MainTabPanels } from './MainTabPanels';
import { HomeTabScrollProvider, useHomeTabScroll } from '@/contexts/HomeTabScrollContext';
import { HomeHeaderChrome } from './HomeHeaderChrome';
import {
  clearHomeMotionProfilerEntries,
  getHomeMotionProfilerEntries,
  getHomeMotionProfilerSummary,
  markHomeMotionEvent,
  setHomeMotionProfilerEnabled,
  syncHomeMotionProfilerFromLocationSearch,
} from '@/lib/homeMotionProfiler';

const MemoizedMainTabPanels = MainTabPanels;
const PENDING_HOME_SCROLL_AFTER_REGISTER_KEY = 'mainTab_pending_home_scroll_after_register';

function HomeHeaderChromeContainer({
  session,
  userProfile,
  unreadCount,
  loadingTab,
  activeTab,
  lockChromeLayout,
  lockTabLayout,
  onCreatePostClick,
  onNotificationClick,
  onTabRefresh,
  onTabSwitchStart,
  onTabChange,
  setProfileOverlayOpen,
}: {
  session: unknown;
  userProfile: unknown;
  unreadCount: number;
  loadingTab: 'recommend' | 'sold' | null;
  activeTab: 'recommend' | 'sold';
  lockChromeLayout: boolean;
  lockTabLayout: boolean;
  onCreatePostClick: () => void;
  onNotificationClick: () => void;
  onTabRefresh: () => void;
  onTabSwitchStart: (tab: 'recommend' | 'sold') => void;
  onTabChange: (tab: 'recommend' | 'sold') => void;
  setProfileOverlayOpen: (open: boolean) => void;
}) {
  const isHeaderVisible = useHeaderVisibilityState();

  return (
    <HomeHeaderChrome
      session={session}
      userProfile={userProfile}
      unreadCount={unreadCount}
      isHeaderVisible={isHeaderVisible}
      loadingTab={loadingTab}
      activeTab={activeTab}
      lockChromeLayout={lockChromeLayout}
      lockTabLayout={lockTabLayout}
      onCreatePostClick={onCreatePostClick}
      onNotificationClick={onNotificationClick}
      onTabRefresh={onTabRefresh}
      onTabSwitchStart={onTabSwitchStart}
      onTabChange={onTabChange}
      setProfileOverlayOpen={setProfileOverlayOpen}
    />
  );
}

function MainTabLayoutClientInner({ children }: { children: React.ReactNode }) {
    // Prefetch notification/profile หลังโหลดโฮมสำเร็จ (firstFeedLoaded)
    // (firstFeedLoaded จะถูกประกาศทีเดียวด้านล่าง ไม่ซ้ำ)
  const router = useRouter();
  const pathname = usePathname();
  const [initialPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : ''
  );
  const resolvedPathname = pathname ?? initialPathname;
  const isMainTabRoute =
    resolvedPathname === '/home' || resolvedPathname === '/notification' || resolvedPathname === '/profile' || resolvedPathname === '/compare';
  const { session, userProfile, activeProfileId } = useSessionAndProfile();
  const { unreadCount, refetch: refetchUnreadCount } = useUnreadNotificationCount({
    userId: activeProfileId || session?.user?.id,
  });
  const { hiddenFileInputRef, handleFileChange, handleCreatePostClick } = useFileUpload();
  const mainTab = useMainTabContext();
  const createPostContext = useCreatePostContext();
  const homeRefreshContext = useHomeRefreshContext();
  const { firstFeedLoaded } = useFirstFeedLoaded();
  const setHeaderVisible = useSetHeaderVisibility();
  const homeTabScroll = useHomeTabScroll();
  const mainTabScroll = useMainTabScroll();
  const isProfileOverlayOpen = mainTab?.isProfileOverlayOpen ?? false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncHomeMotionProfilerFromLocationSearch(window.location.search);
    const qs = new URLSearchParams(window.location.search);
    const traceOneShot = qs.get('homePerfTrace') === '1';

    // Console helpers for real-device profiling (before/after comparison).
    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
    }).__homePerfEnable = () => setHomeMotionProfilerEnabled(true);

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
    }).__homePerfDisable = () => setHomeMotionProfilerEnabled(false);

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
      __homePerfReset?: () => void;
      __homePerfTraceOnce?: () => void;
    }).__homePerfSummary = () => getHomeMotionProfilerSummary();

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
      __homePerfReset?: () => void;
      __homePerfTraceOnce?: () => void;
    }).__homePerfVisibility = () => {
      const entries = getHomeMotionProfilerEntries();
      const recent = entries
        .filter((entry) => {
          if (entry.channel === 'motion-apply') return true;
          if (entry.channel !== 'scroll-handler') return false;
          const action = typeof entry.detail?.action === 'string' ? entry.detail.action : '';
          return action.includes('hide') || action.includes('show') || action.includes('suppressed');
        })
        .slice(-40)
        .map((entry) => ({
          channel: entry.channel,
          name: entry.name,
          durationMs: Number(entry.durationMs.toFixed(2)),
          detail: entry.detail,
          at: entry.at,
        }));
      if (recent.length > 0) console.table(recent);
      return recent;
    };

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
      __homePerfReset?: () => void;
      __homePerfTraceOnce?: () => void;
    }).__homePerfReset = () => clearHomeMotionProfilerEntries();

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
      __homePerfVisibility?: () => unknown;
      __homePerfReset?: () => void;
      __homePerfTraceOnce?: () => void;
    }).__homePerfTraceOnce = () => {
      clearHomeMotionProfilerEntries();
      setHomeMotionProfilerEnabled(true);
      window.setTimeout(() => {
        const summary = getHomeMotionProfilerSummary(30);
        const entries = getHomeMotionProfilerEntries();
        if (summary.length > 0) console.table(summary);
        if (entries.length > 0) {
          const topEntries = [...entries]
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 20)
            .map((entry) => ({
              channel: entry.channel,
              name: entry.name,
              durationMs: Number(entry.durationMs.toFixed(2)),
              at: entry.at,
              detail: entry.detail,
            }));
          console.table(topEntries);
        }
      }, 8000);
    };

    if (traceOneShot) {
      clearHomeMotionProfilerEntries();
      setHomeMotionProfilerEnabled(true);
      window.setTimeout(() => {
        const summary = getHomeMotionProfilerSummary(30);
        if (summary.length > 0) console.table(summary);
      }, 8000);
    }

    markHomeMotionEvent('main-tab-layout-mounted', { pathname: resolvedPathname });
  }, [resolvedPathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const body = document.body;
    const html = document.documentElement;

    if (resolvedPathname !== '/home' || isProfileOverlayOpen) {
      return;
    }

    // Home feed scrolls on window/body. Reset any stale scroll locks left by overlays/pages.
    body.style.overflow = '';
    html.style.overflow = '';

    const handleGestureEvent = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(FULLSCREEN_VIEWER_ROOT_SELECTOR)) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('gesturestart', handleGestureEvent, { passive: false });
    window.addEventListener('gesturechange', handleGestureEvent, { passive: false });
    window.addEventListener('gestureend', handleGestureEvent, { passive: false });

    return () => {
      window.removeEventListener('gesturestart', handleGestureEvent);
      window.removeEventListener('gesturechange', handleGestureEvent);
      window.removeEventListener('gestureend', handleGestureEvent);
    };
  }, [resolvedPathname, isProfileOverlayOpen]);

  useEffect(() => {
    if (resolvedPathname !== '/home' || typeof window === 'undefined') return;

    let pendingScroll: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(PENDING_HOME_SCROLL_AFTER_REGISTER_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) pendingScroll = Math.max(0, n);
      }
      window.sessionStorage.removeItem(PENDING_HOME_SCROLL_AFTER_REGISTER_KEY);
    } catch {
      pendingScroll = null;
    }

    if (pendingScroll == null) return;

    const restore = () => {
      window.scrollTo({ top: pendingScroll as number, left: 0, behavior: 'auto' });
      mainTabScroll?.saveCurrentScroll('/home');
    };

    const rafId = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });

    const timer = window.setTimeout(restore, 320);
    const lateTimer = window.setTimeout(restore, 1200);
    const finalTimer = window.setTimeout(restore, 2200);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timer);
      window.clearTimeout(lateTimer);
      window.clearTimeout(finalTimer);
    };
  }, [resolvedPathname, mainTabScroll]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') return;

    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (!isIOS) return;

    const body = document.body;
    const html = document.documentElement;
    const shouldHideScrollbar = resolvedPathname === '/home' && !isProfileOverlayOpen;

    if (shouldHideScrollbar) {
      body.setAttribute('data-home-ios-scrollbar-hidden', '1');
      html.setAttribute('data-home-ios-scrollbar-hidden', '1');
    } else {
      body.removeAttribute('data-home-ios-scrollbar-hidden');
      html.removeAttribute('data-home-ios-scrollbar-hidden');
    }

    return () => {
      body.removeAttribute('data-home-ios-scrollbar-hidden');
      html.removeAttribute('data-home-ios-scrollbar-hidden');
    };
  }, [resolvedPathname, isProfileOverlayOpen]);

  /** จำ path ที่โหลดแล้ว — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook) */
  useEffect(() => {
    if (resolvedPathname) markRouteVisited(resolvedPathname);
  }, [resolvedPathname]);

  /** สลับกลับมาหน้าโฮมเท่านั้น → แสดง navigation bar ครั้งเดียว (ไม่รันทุกครั้งที่ headerVisibility เปลี่ยน ไม่งั้นเลื่อนฟีดแล้ว nav จะไม่หาย) */
  const prevPathnameRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = resolvedPathname;
    if (resolvedPathname === '/home' && prev !== '/home') {
      setHeaderVisible?.(true);
    }
  }, [resolvedPathname, setHeaderVisible]);

  /** สลับแท็บหลัก: ออกจากโฮมให้ save แน่ๆ และกลับเข้าโฮมให้ restore แบบ retry (แนวเดียวกับ viewing mode) */
  const prevMainTabPathRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevMainTabPathRef.current;
    prevMainTabPathRef.current = resolvedPathname;
    if (!prev) return;

    const leftHomeToMainTab =
      prev === '/home' && (resolvedPathname === '/notification' || resolvedPathname === '/profile' || resolvedPathname === '/compare');
    if (leftHomeToMainTab) {
      mainTabScroll?.saveCurrentScroll('/home');
      return;
    }

    const returnedHomeFromMainTab =
      resolvedPathname === '/home' && (prev === '/notification' || prev === '/profile' || prev === '/compare' || prev === '/register');
    if (!returnedHomeFromMainTab) return;

    // ยิง restore ทันที + retry 2 เฟรม + timeout เพื่อกันจังหวะ iOS/layout race
    mainTabScroll?.restoreScrollForTab('/home');
    const rafIds: number[] = [];
    const raf1 = requestAnimationFrame(() => {
      mainTabScroll?.restoreScrollForTab('/home');
      const raf2 = requestAnimationFrame(() => {
        mainTabScroll?.restoreScrollForTab('/home');
      });
      rafIds.push(raf2);
    });
    rafIds.push(raf1);
    const timer = setTimeout(() => {
      mainTabScroll?.restoreScrollForTab('/home');
    }, 260);

    return () => {
      rafIds.forEach((id) => cancelAnimationFrame(id));
      clearTimeout(timer);
    };
  }, [resolvedPathname, mainTabScroll]);

  useEffect(() => {
    const handler = () => handleCreatePostClick(session);
    createPostContext?.register(handler);
    return () => createPostContext?.register(null);
  }, [session, createPostContext, handleCreatePostClick]);

  const setProfileOverlayOpen = useCallback((open: boolean) => {
    if (open && (resolvedPathname === '/home' || resolvedPathname === '/notification' || resolvedPathname === '/profile' || resolvedPathname === '/compare')) {
      mainTabScroll?.saveCurrentScroll(resolvedPathname);
    }
    mainTab?.setProfileOverlayOpen(open);
  }, [mainTab, mainTabScroll, resolvedPathname]);

  const handleNotificationClick = useCallback(() => {
    if (!session) {
      router.push(REGISTER_PATH, { scroll: false });
      return;
    }
    if (resolvedPathname === '/home' || resolvedPathname === '/notification' || resolvedPathname === '/profile' || resolvedPathname === '/compare') {
      mainTabScroll?.saveCurrentScroll(resolvedPathname);
    }
    router.push('/notification', { scroll: false });
  }, [session, router, mainTabScroll, resolvedPathname]);

  /** กดไอคอนโฮม (อยู่ที่โฮมแล้ว) = refresh อย่างเดียว ไม่ล้างคำค้น */
  const handleTabRefresh = useCallback(() => {
    mainTab?.setTabRefreshing(true);
    mainTab?.triggerTabRefresh();
  }, [mainTab]);

  /** กดโลโก้ = ล้างคำค้น + refresh */
  const handleLogoRefresh = useCallback(() => {
    mainTab?.setTabRefreshing(true);
    mainTab?.triggerTabRefresh({ fromHomeButton: true });
  }, [mainTab]);

  const handleTabSwitchStart = useCallback(
    (tab: 'recommend' | 'sold') => {
      mainTab?.setNavigatingToTab(tab);
    },
    [mainTab],
  );

  useEffect(() => {
    if (resolvedPathname !== '/home') {
      homeRefreshContext?.register(null);
      return;
    }
    homeRefreshContext?.register(handleTabRefresh);
    return () => homeRefreshContext?.register(null);
  }, [resolvedPathname, mainTab, homeRefreshContext, handleTabRefresh]);

  /** Prefetch หน้าอื่นเมื่อเครื่องว่าง — delay 4–5 วินาทีบนโฮมเพื่อลดงานช่วงโหลดหน้าแรก */
  useEffect(() => {
    if (resolvedPathname === '/home' && !firstFeedLoaded) return;

    const delay = resolvedPathname === '/home' ? 1200 : 1000;
    const t = setTimeout(() => {
      if (resolvedPathname === '/home') {
        router.prefetch('/notification');
        router.prefetch('/profile');
        router.prefetch('/compare');
      } else if (resolvedPathname === '/notification' || resolvedPathname === '/profile' || resolvedPathname === '/compare') {
        router.prefetch('/home');
        if (resolvedPathname === '/notification') {
          router.prefetch('/profile');
          router.prefetch('/compare');
        } else if (resolvedPathname === '/profile') {
          router.prefetch('/notification');
          router.prefetch('/compare');
        } else {
          router.prefetch('/notification');
          router.prefetch('/profile');
        }
      }
    }, delay);
    return () => clearTimeout(t);
  }, [resolvedPathname, router, firstFeedLoaded]);

  const loadingTab =
    mainTab?.navigatingToTab ?? (mainTab?.tabRefreshing ? mainTab?.homeTab ?? null : null);

  /** หน้าโฮม: ต้อง mount header/tab bar ตั้งแต่เฟรมแรกหลัง refresh เพื่อให้ motion system พร้อมทันที */
  const showHomeHeader = resolvedPathname === '/home';
  const lockHomeChromeLayout = showHomeHeader && !firstFeedLoaded;
  const lockHomeTabLayout = showHomeHeader && !firstFeedLoaded;

  /** เมื่อ header โฮมจะแสดง ให้ดึงตัวเลขแจ้งเตือนเลย เพื่อให้ badge แสดงใน Navigation bar */
  useEffect(() => {
    if (resolvedPathname === '/home' && firstFeedLoaded && session?.user?.id) {
      refetchUnreadCount();
    }
  }, [resolvedPathname, firstFeedLoaded, session?.user?.id, refetchUnreadCount]);

  const handleHomeTabChange = useCallback(
    (tab: 'recommend' | 'sold') => {
      if (resolvedPathname === '/home') {
        homeTabScroll?.saveCurrentHomeTabScroll();
      }
      mainTab?.triggerTabChange(tab);
    },
    [resolvedPathname, homeTabScroll, mainTab],
  );

  return (
    <>
      <input
        type="file"
        ref={hiddenFileInputRef}
        multiple
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden
      />
      {showHomeHeader ? (
        <HomeHeaderChromeContainer
          session={session}
          userProfile={userProfile}
          unreadCount={unreadCount}
          loadingTab={loadingTab}
          activeTab={mainTab?.homeTab ?? 'recommend'}
          lockChromeLayout={lockHomeChromeLayout}
          lockTabLayout={lockHomeTabLayout}
          onCreatePostClick={() => handleCreatePostClick(session)}
          onNotificationClick={handleNotificationClick}
          onTabRefresh={handleLogoRefresh}
          onTabSwitchStart={handleTabSwitchStart}
          onTabChange={handleHomeTabChange}
          setProfileOverlayOpen={setProfileOverlayOpen}
        />
      ) : null}

      {isProfileOverlayOpen && (
        <ProfileOverlay
          isOpen={isProfileOverlayOpen}
          onClose={() => setProfileOverlayOpen(false)}
        />
      )}

      <MemoizedMainTabPanels />
      {!isMainTabRoute ? children : null}
    </>
  );
}

export function MainTabLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <HomeTabScrollProvider>
      <MainTabLayoutClientInner>{children}</MainTabLayoutClientInner>
    </HomeTabScrollProvider>
  );
}
