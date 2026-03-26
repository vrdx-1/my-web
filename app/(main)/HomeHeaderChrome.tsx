'use client';

import React, { memo } from 'react';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const HOME_FIXED_BLOCK_HEIGHT = 102;

export interface HomeHeaderChromeProps {
  session: unknown;
  userProfile: unknown;
  unreadCount: number;
  isHeaderVisible: boolean;
  loadingTab: 'recommend' | 'sold' | null;
  activeTab: 'recommend' | 'sold';
  onCreatePostClick: () => void;
  onNotificationClick: () => void;
  onTabRefresh: () => void;
  onTabSwitchStart: (tab: 'recommend' | 'sold') => void;
  onTabChange: (tab: 'recommend' | 'sold') => void;
  setProfileOverlayOpen: (open: boolean) => void;
}

function HomeHeaderChromeBase(props: HomeHeaderChromeProps) {
  const {
    session,
    userProfile,
    unreadCount,
    isHeaderVisible,
    loadingTab,
    activeTab,
    onCreatePostClick,
    onNotificationClick,
    onTabRefresh,
    onTabSwitchStart,
    onTabChange,
    setProfileOverlayOpen,
  } = props;

  return (
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
          transform: isHeaderVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -100%, 0)',
          boxShadow: 'none',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.24s ease-out',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          contain: 'paint',
        }}
      >
        <HomeHeader
          onCreatePostClick={onCreatePostClick}
          onNotificationClick={onNotificationClick}
          unreadCount={unreadCount}
          userProfile={userProfile}
          session={session}
          isHeaderVisible={isHeaderVisible}
          slideWithContainer={true}
          onTabRefresh={onTabRefresh}
          onTabSwitchStart={onTabSwitchStart}
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
            activeTab={activeTab}
            onTabChange={(value) => onTabChange(value as 'recommend' | 'sold')}
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
  );
}

export const HomeHeaderChrome = memo(HomeHeaderChromeBase);