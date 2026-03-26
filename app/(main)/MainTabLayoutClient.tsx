'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TabNavigation } from '@/components/TabNavigation';
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
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { MainTabPanels } from './MainTabPanels';
import { HomeTabScrollProvider, useHomeTabScroll } from '@/contexts/HomeTabScrollContext';

function MainTabLayoutClientInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount, refetch: refetchUnreadCount } = useUnreadNotificationCount({
    userId: session?.user?.id,
  });
  const fileUpload = useFileUpload();
  const mainTab = useMainTabContext();
  const createPostContext = useCreatePostContext();
  const homeRefreshContext = useHomeRefreshContext();
  const homeProvince = useHomeProvince();
  const headerVisibility = useHeaderVisibilityContext();
  const homeTabScroll = useHomeTabScroll();

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
      headerVisibility?.snapHeaderVisible?.(true) ?? headerVisibility?.setHeaderVisible(true);
    }
  }, [pathname, headerVisibility]);

  useEffect(() => {
    const handler = () => fileUpload.handleCreatePostClick(session);
    createPostContext?.register(handler);
    return () => createPostContext?.register(null);
  }, [session, createPostContext, fileUpload.handleCreatePostClick]);

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

  /** ความสูงรวมของ fixed block: header + tab bar (สำหรับ header โฮมที่เตี้ยลง) */
  // ต้องชดเชยความสูงที่เพิ่มขึ้นจากการขยับแท็บลงในหน้า home (ดู wrapper ด้านล่าง)
  const HOME_FIXED_BLOCK_HEIGHT = 102;

  const isHeaderVisible = showHomeHeader ? (headerVisibility?.isHeaderVisible ?? true) : true;

  return (
    <>
      <input
        type="file"
        ref={fileUpload.hiddenFileInputRef}
        multiple
        accept="image/*"
        onChange={fileUpload.handleFileChange}
        style={{ display: 'none' }}
        aria-hidden
      />
      {showHomeHeader ? (
        <>
          <div
            className="header-visibility-surface"
            data-home-header-motion-surface="1"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 500,
              background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              transform: 'translate3d(0, 0, 0)',
              boxShadow: 'none',
              transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease-out',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              contain: 'paint',
            }}
          >
            <HomeHeader
              onCreatePostClick={() => fileUpload.handleCreatePostClick(session)}
              onNotificationClick={handleNotificationClick}
              unreadCount={unreadCount}
              userProfile={userProfile}
              session={session}
              isHeaderVisible={isHeaderVisible}
              slideWithContainer={true}
              onTabRefresh={handleLogoRefresh}
              onTabSwitchStart={handleTabSwitchStart}
              loadingTab={loadingTab ?? undefined}
              setProfileOverlayOpen={setProfileOverlayOpen}
              showOnlySearch={true}
            />
            <div style={{ marginTop: 7 }}>
              <TabNavigation
                className="home-tab-navigation"
                tabs={[
                  { value: 'recommend', label: 'ພ້ອມຂາຍ' },
                  { value: 'sold', label: 'ຂາຍແລ້ວ' },
                ]}
                activeTab={mainTab?.homeTab ?? 'recommend'}
                onTabChange={(v) => {
                  if (pathname === '/home') {
                    homeTabScroll?.saveCurrentHomeTabScroll();
                    headerVisibility?.snapHeaderVisible?.(true) ?? headerVisibility?.setHeaderVisible(true);
                  }
                  homeProvince?.setSelectedProvince('');
                  mainTab?.triggerTabChange(v as 'recommend' | 'sold');
                }}
                loadingTab={loadingTab}
              />
            </div>
          </div>
          <div
            style={{
              height: HOME_FIXED_BLOCK_HEIGHT,
              background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
            }}
          />
        </>
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
