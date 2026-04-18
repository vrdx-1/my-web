'use client';

import React, { useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { HomeHeaderSearchAndFilter } from '@/components/home/HomeHeaderSearchAndFilter';
import { APP_HEADER_PRESET } from '@/utils/appHeaderPreset';

export type HomeHeaderProps = React.ComponentProps<typeof AppHeader>;

function HomeHeaderBase(props: HomeHeaderProps) {
  const homeCenterContent = useMemo(
    () => (props.showOnlySearch ? <HomeHeaderSearchAndFilter /> : undefined),
    [props.showOnlySearch]
  );

  return <AppHeader {...APP_HEADER_PRESET} {...props} homeCenterContent={homeCenterContent} />;
}

function areHomeHeaderPropsEqual(prev: HomeHeaderProps, next: HomeHeaderProps) {
  const sameSlideMode = prev.slideWithContainer === next.slideWithContainer;
  const sameVisibility = sameSlideMode && prev.slideWithContainer
    ? true
    : prev.isHeaderVisible === next.isHeaderVisible;

  const bothSearchOnly = !!prev.showOnlySearch && !!next.showOnlySearch;
  if (bothSearchOnly) {
    return (
      prev.showOnlySearch === next.showOnlySearch &&
      sameVisibility &&
      prev.slideWithContainer === next.slideWithContainer &&
      prev.onTabRefresh === next.onTabRefresh
    );
  }

  return (
    prev.showOnlySearch === next.showOnlySearch &&
    sameVisibility &&
    prev.slideWithContainer === next.slideWithContainer &&
    prev.onCreatePostClick === next.onCreatePostClick &&
    prev.onNotificationClick === next.onNotificationClick &&
    prev.unreadCount === next.unreadCount &&
    prev.userProfile === next.userProfile &&
    prev.session === next.session &&
    prev.iconSize === next.iconSize &&
    prev.controlSize === next.controlSize &&
    prev.onTabRefresh === next.onTabRefresh &&
    prev.onTabSwitchStart === next.onTabSwitchStart &&
    prev.loadingTab === next.loadingTab &&
    prev.setProfileOverlayOpen === next.setProfileOverlayOpen
  );
}

export const HomeHeader = React.memo(HomeHeaderBase, areHomeHeaderPropsEqual);
