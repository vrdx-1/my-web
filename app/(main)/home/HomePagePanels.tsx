'use client';

import React, { memo } from 'react';
import { HomeFeedBody, type HomeFeedBodyProps } from './HomeFeedBody';
import { SoldTabFeedWrapper, type SoldTabFeedWrapperProps } from './SoldTabFeedWrapper';

export interface HomePagePanelsProps {
  feedRestoreWrapRef: React.RefObject<HTMLDivElement | null>;
  recommendPanelRef: React.RefObject<HTMLDivElement | null>;
  soldPanelRef: React.RefObject<HTMLDivElement | null>;
  isSoldTabActive: boolean;
  isSoldTabNoSearch: boolean;
  showFeedSkeleton: boolean;
  searchWaitingResults: boolean;
  hasSearch: boolean;
  searchDataLoading: boolean;
  tab: 'recommend' | 'sold';
  onPrefetchNextPost: () => void;
  onLocalPostUpdate?: (postId: string, data: Record<string, unknown>) => void;
  recommendPostFeedProps: HomeFeedBodyProps['postFeedProps'];
  soldTabProps: Omit<SoldTabFeedWrapperProps, 'isActive'>;
}

function HomePagePanelsBase(props: HomePagePanelsProps) {
  const {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    isSoldTabActive,
    isSoldTabNoSearch,
    showFeedSkeleton,
    searchWaitingResults,
    hasSearch,
    searchDataLoading,
    tab,
    onPrefetchNextPost,
    onLocalPostUpdate,
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
          onLocalPostUpdate={onLocalPostUpdate}
        />
      </div>
      <div
        ref={soldPanelRef}
        style={{ display: isSoldTabNoSearch ? 'block' : 'none' }}
        aria-hidden={!isSoldTabNoSearch}
      >
        <SoldTabFeedWrapper isActive={isSoldTabActive} {...soldTabProps} />
      </div>
    </div>
  );
}

export const HomePagePanels = memo(HomePagePanelsBase);