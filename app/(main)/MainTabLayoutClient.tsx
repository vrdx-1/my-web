'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
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

function MainTabLayoutClientInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [initialPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : ''
  );
  const resolvedPathname = pathname ?? initialPathname;
  const { session, userProfile, activeProfileId } = useSessionAndProfile();
  const { unreadCount, refetch: refetchUnreadCount } = useUnreadNotificationCount({
    userId: activeProfileId || session?.user?.id,
  });
  const { hiddenFileInputRef, handleFileChange, handleCreatePostClick } = useFileUpload();
  const mainTab = useMainTabContext();
  const createPostContext = useCreatePostContext();
  const homeRefreshContext = useHomeRefreshContext();
  const homeProvince = useHomeProvince();
  const headerVisibility = useHeaderVisibilityContext();
  const homeTabScroll = useHomeTabScroll();

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
    const previousBodyTouchAction = body.style.touchAction;

    if (resolvedPathname !== '/home') {
      return;
    }

    // Home feed scrolls on window/body. Reset any stale scroll locks left by overlays/pages.
    body.style.overflow = '';
    html.style.overflow = '';
    body.style.touchAction = 'manipulation';

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
      body.style.touchAction = previousBodyTouchAction;
    };
  }, [resolvedPathname]);

  /** จำ path ที่โหลดแล้ว — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook) */
  useEffect(() => {
    if (resolvedPathname) markRouteVisited(resolvedPathname);
  }, [resolvedPathname]);

  /** สลับกลับมาหน้าโฮมเท่านั้น → แสดง navigation bar ครั้งเดียว (ไม่รันทุกครั้งที่ headerVisibility เปลี่ยน ไม่งั้นเลื่อนฟีดแล้ว nav จะไม่หาย) */
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = resolvedPathname;
    if (resolvedPathname === '/home' && prev !== '/home') {
      headerVisibility?.setHeaderVisible(true);
    }
  }, [resolvedPathname, headerVisibility]);

  useEffect(() => {
    const handler = () => handleCreatePostClick(session);
    createPostContext?.register(handler);
    return () => createPostContext?.register(null);
  }, [session, createPostContext, handleCreatePostClick]);

  const isProfileOverlayOpen = mainTab?.isProfileOverlayOpen ?? false;
  const setProfileOverlayOpen = mainTab?.setProfileOverlayOpen ?? (() => {});

  const handleNotificationClick = useCallback(() => {
    if (!session) {
      router.push(REGISTER_PATH);
      return;
    }
    router.push('/notification');
  }, [session, router]);

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
    const delay = resolvedPathname === '/home' ? 4500 : 1000;
    const t = setTimeout(() => {
      if (resolvedPathname === '/home') {
        router.prefetch('/notification');
        router.prefetch('/profile');
      } else if (resolvedPathname === '/notification' || resolvedPathname?.startsWith('/profile')) {
        router.prefetch('/home');
        if (resolvedPathname === '/notification') router.prefetch('/profile');
        else router.prefetch('/notification');
      }
    }, delay);
    return () => clearTimeout(t);
  }, [resolvedPathname, router]);

  const loadingTab =
    mainTab?.navigatingToTab ?? (mainTab?.tabRefreshing ? mainTab?.homeTab ?? null : null);

  const { firstFeedLoaded } = useFirstFeedLoaded();
  /** หน้าโฮม: ต้อง mount header/tab bar ตั้งแต่เฟรมแรกหลัง refresh เพื่อให้ motion system พร้อมทันที */
  const showHomeHeader = resolvedPathname === '/home';

  /** เมื่อ header โฮมจะแสดง ให้ดึงตัวเลขแจ้งเตือนเลย เพื่อให้ badge แสดงใน Navigation bar */
  useEffect(() => {
    if (resolvedPathname === '/home' && firstFeedLoaded && session?.user?.id) {
      refetchUnreadCount();
    }
  }, [resolvedPathname, firstFeedLoaded, session?.user?.id, refetchUnreadCount]);

  const isHeaderVisible = showHomeHeader ? (headerVisibility?.isHeaderVisible ?? true) : true;

  const handleHomeTabChange = useCallback(
    (tab: 'recommend' | 'sold') => {
      if (resolvedPathname === '/home') {
        homeTabScroll?.saveCurrentHomeTabScroll();
      }
      homeProvince?.setSelectedProvince('');
      mainTab?.triggerTabChange(tab);
    },
    [resolvedPathname, homeTabScroll, homeProvince, mainTab],
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
        <HomeHeaderChrome
          session={session}
          userProfile={userProfile}
          unreadCount={unreadCount}
          isHeaderVisible={isHeaderVisible}
          loadingTab={loadingTab}
          activeTab={mainTab?.homeTab ?? 'recommend'}
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

      {resolvedPathname === '/home' || resolvedPathname === '/notification' || resolvedPathname === '/profile' ? (
        <MainTabPanels />
      ) : (
        children
      )}
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
