'use client';

import React, { memo } from 'react';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { MOTION_TRANSITIONS } from '@/utils/motionConstants';

const HOME_CHROME_HEIGHT = 102;

export interface HomeHeaderChromeProps {
  session: unknown;
  userProfile: unknown;
  unreadCount: number;
  isHeaderVisible: boolean;
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
}

function HomeHeaderChromeBase(props: HomeHeaderChromeProps) {
  const {
    session,
    userProfile,
    unreadCount,
    isHeaderVisible,
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
  } = props;

  return (
    <div
      className="header-visibility-surface"
      data-home-header-motion-surface="1"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 500,
        width: '100%',
        background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
        backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
        transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
        marginBottom: isHeaderVisible ? 0 : `-${HOME_CHROME_HEIGHT}px`,
        boxShadow: 'none',
        transition:
          `${MOTION_TRANSITIONS.HOME_CHROME}, margin-bottom 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: 'transform, margin-bottom',
        backfaceVisibility: 'hidden',
        pointerEvents: isHeaderVisible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
          margin: '0 auto',
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
          backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
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
          lockHomeLayout={lockChromeLayout}
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
            lockLayout={lockTabLayout}
            hideIndicator={lockTabLayout}
            loadingTab={loadingTab}
          />
        </div>
      </div>
    </div>
  );
}

export const HomeHeaderChrome = memo(HomeHeaderChromeBase);