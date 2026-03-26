'use client';

import { useCallback, useEffect, useRef } from 'react';
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
import { markRouteVisited } from '@/utils/visitedRoutesStore';
import { MainTabPanels } from './MainTabPanels';
import { HomeTabScrollProvider, useHomeTabScroll } from '@/contexts/HomeTabScrollContext';
import { HomeHeaderChrome } from './HomeHeaderChrome';
import {
  getHomeMotionProfilerSummary,
  markHomeMotionEvent,
  setHomeMotionProfilerEnabled,
  syncHomeMotionProfilerFromLocationSearch,
} from '@/lib/homeMotionProfiler';

function MainTabLayoutClientInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount, refetch: refetchUnreadCount } = useUnreadNotificationCount({
    userId: session?.user?.id,
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

    // Console helpers for real-device profiling (before/after comparison).
    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
    }).__homePerfEnable = () => setHomeMotionProfilerEnabled(true);

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
    }).__homePerfDisable = () => setHomeMotionProfilerEnabled(false);

    (window as typeof window & {
      __homePerfEnable?: () => void;
      __homePerfDisable?: () => void;
      __homePerfSummary?: () => unknown;
    }).__homePerfSummary = () => getHomeMotionProfilerSummary();

    markHomeMotionEvent('main-tab-layout-mounted', { pathname });
  }, [pathname]);

  /** จำ path ที่โหลดแล้ว — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook) */
  useEffect(() => {
    if (pathname) markRouteVisited(pathname);
  }, [pathname]);

  /** สลับกลับมาหน้าโฮมเท่านั้น → แสดง navigation bar ครั้งเดียว (ไม่รันทุกครั้งที่ headerVisibility เปลี่ยน ไม่งั้นเลื่อนฟีดแล้ว nav จะไม่หาย) */
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname === '/home' && prev !== '/home') {
      headerVisibility?.setHeaderVisible(true);
    }
  }, [pathname, headerVisibility]);

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
    if (pathname !== '/home') {
      homeRefreshContext?.register(null);
      return;
    }
    homeRefreshContext?.register(handleTabRefresh);
    return () => homeRefreshContext?.register(null);
  }, [pathname, mainTab, homeRefreshContext, handleTabRefresh]);

  /** Prefetch หน้าอื่นเมื่อเครื่องว่าง — delay 4–5 วินาทีบนโฮมเพื่อลดงานช่วงโหลดหน้าแรก */
  useEffect(() => {
    const delay = pathname === '/home' ? 4500 : 1000;
    const t = setTimeout(() => {
      if (pathname === '/home') {
        router.prefetch('/notification');
        router.prefetch('/profile');
      } else if (pathname === '/notification' || pathname?.startsWith('/profile')) {
        router.prefetch('/home');
        if (pathname === '/notification') router.prefetch('/profile');
        else router.prefetch('/notification');
      }
    }, delay);
    return () => clearTimeout(t);
  }, [pathname, router]);

  const loadingTab =
    mainTab?.navigatingToTab ?? (mainTab?.tabRefreshing ? mainTab?.homeTab ?? null : null);

  const { firstFeedLoaded } = useFirstFeedLoaded();
  /** หน้าโฮม: ต้อง mount header/tab bar ตั้งแต่เฟรมแรกหลัง refresh เพื่อให้ motion system พร้อมทันที */
  const showHomeHeader = pathname === '/home';

  /** เมื่อ header โฮมจะแสดง ให้ดึงตัวเลขแจ้งเตือนเลย เพื่อให้ badge แสดงใน Navigation bar */
  useEffect(() => {
    if (pathname === '/home' && firstFeedLoaded && session?.user?.id) {
      refetchUnreadCount();
    }
  }, [pathname, firstFeedLoaded, session?.user?.id, refetchUnreadCount]);

  const isHeaderVisible = showHomeHeader ? (headerVisibility?.isHeaderVisible ?? true) : true;

  const handleHomeTabChange = useCallback(
    (tab: 'recommend' | 'sold') => {
      if (pathname === '/home') {
        homeTabScroll?.saveCurrentHomeTabScroll();
        headerVisibility?.setHeaderVisible(true);
      }
      homeProvince?.setSelectedProvince('');
      mainTab?.triggerTabChange(tab);
    },
    [pathname, homeTabScroll, headerVisibility, homeProvince, mainTab],
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

      {pathname === '/home' || pathname === '/notification' || pathname === '/profile' ? (
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
