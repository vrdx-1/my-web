'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
import { ProfileOverlay } from '@/components/ProfileOverlay';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** Context: setter สำหรับอัปเดต pull offset, และค่าปัจจุบันให้ฟีดโยโย้ (translate) ลงมา */
type PullHeaderOffsetContextValue = { setPullHeaderOffset: (v: number) => void; pullHeaderOffset: number };
const PullHeaderOffsetContext = createContext<PullHeaderOffsetContextValue | null>(null);
export function usePullHeaderOffset() {
  return useContext(PullHeaderOffsetContext);
}

export function MainTabLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount } = useUnreadNotificationCount({ userId: session?.user?.id });
  const fileUpload = useFileUpload();
  const mainTab = useMainTabContext();
  const createPostContext = useCreatePostContext();
  const homeRefreshContext = useHomeRefreshContext();

  /** State อยู่ที่ layout เลย — เวลาหน้าโฮม/ขายแล้วเรียก setPullHeaderOffset จะ re-render layout และ Header เลื่อนลงทันที */
  const [pullOffset, setPullOffset] = useState(0);
  useEffect(() => {
    if (pathname !== '/home') setPullOffset(0);
  }, [pathname]);

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

  const handleTabRefresh = useCallback(() => {
    mainTab?.setTabRefreshing(true);
    mainTab?.triggerTabRefresh();
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
    const handler = () => {
      mainTab?.setTabRefreshing(true);
      mainTab?.triggerTabRefresh({ fromHomeButton: true });
    };
    homeRefreshContext?.register(handler);
    return () => homeRefreshContext?.register(null);
  }, [pathname, mainTab, homeRefreshContext]);

  const loadingTab =
    mainTab?.navigatingToTab ??
    (mainTab?.tabRefreshing && mainTab?.refreshSource !== 'pull' ? mainTab?.homeTab ?? null : null);

  const showHomeHeader = pathname === '/home';

  /** ความสูงรวมของ fixed block: header (~59) + tab bar (~45) */
  const HOME_FIXED_BLOCK_HEIGHT = 104;

  const headerVisibility = useHeaderVisibilityContext();
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
      {showHomeHeader && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 500,
              background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
              boxShadow: isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease-out',
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
              onTabRefresh={handleTabRefresh}
              onTabSwitchStart={handleTabSwitchStart}
              loadingTab={loadingTab ?? undefined}
              setProfileOverlayOpen={setProfileOverlayOpen}
              showOnlySearch={true}
            />
            <TabNavigation
              tabs={[
                { value: 'recommend', label: 'ພ້ອມຂາຍ' },
                { value: 'sold', label: 'ຂາຍແລ້ວ' },
              ]}
              activeTab={mainTab?.homeTab ?? 'recommend'}
              onTabChange={(v) => mainTab?.triggerTabChange(v as 'recommend' | 'sold')}
              loadingTab={loadingTab}
            />
          </div>
          <div
            style={{
              height: HOME_FIXED_BLOCK_HEIGHT,
              background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
              backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
            }}
          />
        </>
      )}

      {isProfileOverlayOpen && (
        <ProfileOverlay
          isOpen={isProfileOverlayOpen}
          onClose={() => setProfileOverlayOpen(false)}
        />
      )}

      <PullHeaderOffsetContext.Provider value={{ setPullHeaderOffset: setPullOffset, pullHeaderOffset: pullOffset }}>
        {children}
      </PullHeaderOffsetContext.Provider>
    </>
  );
}
