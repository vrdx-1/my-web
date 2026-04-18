'use client';

import React, { memo } from 'react';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { MOTION_TRANSITIONS } from '@/utils/motionConstants';

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
        aria-hidden
        style={{
          height: HOME_FIXED_BLOCK_HEIGHT,
          pointerEvents: 'none',
        }}
      />
      <div
        className="header-visibility-surface"
        data-home-header-motion-surface="1"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 500,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
            margin: '0 auto',
            background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
            backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
            transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
            boxShadow: 'none',
            transition: MOTION_TRANSITIONS.HOME_CHROME,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            pointerEvents: isHeaderVisible ? 'auto' : 'none',
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
      </div>
    </>
  );
}

export const HomeHeaderChrome = memo(HomeHeaderChromeBase);