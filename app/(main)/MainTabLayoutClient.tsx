'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { HomeHeader } from '@/components/home/HomeHeader';
import { SearchScreen } from '@/components/SearchScreen';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { ProfileOverlay } from '@/components/ProfileOverlay';
import { PROFILE_PATH } from '@/utils/authRoutes';

export function MainTabLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount } = useUnreadNotificationCount({ userId: session?.user?.id });
  const fileUpload = useFileUpload();
  const mainTab = useMainTabContext();

  const searchTerm = mainTab?.searchTerm ?? '';
  const setSearchTerm = mainTab?.setSearchTerm ?? (() => {});
  const isSearchScreenOpen = mainTab?.isSearchScreenOpen ?? false;
  const setIsSearchScreenOpen = mainTab?.setIsSearchScreenOpen ?? (() => {});
  const isProfileOverlayOpen = mainTab?.isProfileOverlayOpen ?? false;
  const setProfileOverlayOpen = mainTab?.setProfileOverlayOpen ?? (() => {});

  const handleNotificationClick = useCallback(() => {
    if (!session) {
      router.push(PROFILE_PATH);
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

  const handleTabChange = useCallback(() => {
    setIsSearchScreenOpen(false);
  }, []);

  const loadingTab =
    mainTab?.navigatingToTab ??
    (mainTab?.tabRefreshing ? (pathname === '/sold' ? 'sold' : 'recommend') : null);

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
      <HomeHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreatePostClick={() => fileUpload.handleCreatePostClick(session)}
        onNotificationClick={handleNotificationClick}
        unreadCount={unreadCount}
        userProfile={userProfile}
        session={session}
        isHeaderVisible={true}
        onTabChange={handleTabChange}
        onSearchClick={() => setIsSearchScreenOpen(true)}
        onTabRefresh={handleTabRefresh}
        onTabSwitchStart={handleTabSwitchStart}
        loadingTab={loadingTab ?? undefined}
        setProfileOverlayOpen={setProfileOverlayOpen}
      />

      {isProfileOverlayOpen && (
        <ProfileOverlay
          isOpen={isProfileOverlayOpen}
          onClose={() => setProfileOverlayOpen(false)}
        />
      )}

      {isSearchScreenOpen && (
        <SearchScreen
          isOpen={isSearchScreenOpen}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClose={() => setIsSearchScreenOpen(false)}
        />
      )}

      <div style={LAYOUT_CONSTANTS.HEADER_SPACER} />

      {children}
    </>
  );
}
