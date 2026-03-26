'use client';

import React, { memo } from 'react';
import { HomeFeedBody, type HomeFeedBodyProps } from './HomeFeedBody';
import { SoldTabFeedWrapper, type SoldTabFeedWrapperProps } from './SoldTabFeedWrapper';

export interface HomePagePanelsProps {
  feedRestoreWrapRef: React.RefObject<HTMLDivElement | null>;
  recommendPanelRef: React.RefObject<HTMLDivElement | null>;
  soldPanelRef: React.RefObject<HTMLDivElement | null>;
  isSoldTabNoSearch: boolean;
  showFeedSkeleton: boolean;
  searchWaitingResults: boolean;
  hasSearch: boolean;
  searchDataLoading: boolean;
  tab: 'recommend' | 'sold';
  onPrefetchNextPost: () => void;
  recommendPostFeedProps: HomeFeedBodyProps['postFeedProps'];
  soldTabProps: Omit<SoldTabFeedWrapperProps, 'isActive'>;
}

function HomePagePanelsBase(props: HomePagePanelsProps) {
  const {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    isSoldTabNoSearch,
    showFeedSkeleton,
    searchWaitingResults,
    hasSearch,
    searchDataLoading,
    tab,
    onPrefetchNextPost,
    recommendPostFeedProps,
    soldTabProps,
  } = props;

  return (
    <div ref={feedRestoreWrapRef}>
      <div
        ref={recommendPanelRef}
        style={{ display: isSoldTabNoSearch ? 'none' : 'block' }}
        aria-hidden={isSoldTabNoSearch}
      >
        <HomeFeedBody
          showSkeleton={showFeedSkeleton}
          forceSkeletonWhenEmpty={searchWaitingResults}
          mayShowEmptyState={!searchWaitingResults}
          isSearchLoading={hasSearch && searchDataLoading}
          skeletonCount={3}
          gateImageReady={tab === 'recommend' && !isSoldTabNoSearch}
          onPrefetchNextPost={onPrefetchNextPost}
          postFeedProps={recommendPostFeedProps}
        />
      </div>
      <div
        ref={soldPanelRef}
        style={{ display: isSoldTabNoSearch ? 'block' : 'none' }}
        aria-hidden={!isSoldTabNoSearch}
      >
        <SoldTabFeedWrapper isActive={isSoldTabNoSearch} {...soldTabProps} />
      </div>
    </div>
  );
}

export const HomePagePanels = memo(HomePagePanelsBase);