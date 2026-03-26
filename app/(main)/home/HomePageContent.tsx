'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { FeedSkeleton } from '@/components/FeedSkeleton';
import { HomePagePanels } from './HomePagePanels';
import { HomePageModals } from './HomePageModals';
import { useHomePageController } from './useHomePageController';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import {
  isHomeMotionProfilerEnabled,
  markHomeMotionEvent,
  recordHomeMotionDuration,
} from '@/lib/homeMotionProfiler';

function subscribeToClientMount() {
  return () => {};
}

export function HomePageContent() {
  const clientMounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  );

  const {
    effectiveSession,
    feedRestoreWrapRef,
    fullScreenViewer,
    handlers,
    hasSearch,
    headerScroll,
    isSoldTabNoSearch,
    isSubmittingReport,
    onPrefetchNextPost,
    recommendPanelRef,
    recommendPostFeedProps,
    reportReason,
    reportingPost,
    searchDataLoading,
    searchWaitingResults,
    setReportReason,
    setReportingPost,
    showFeedSkeleton,
    soldPanelRef,
    soldTabProps,
    tab,
    viewingPostHook,
  } = useHomePageController({ clientMounted });

  useEffect(() => {
    if (!clientMounted || typeof window === 'undefined') return;
    if (!isHomeMotionProfilerEnabled()) return;

    markHomeMotionEvent('home-feed-content-mounted');

    let rafId: number | null = null;
    let prev = performance.now();
    const start = prev;

    const loop = () => {
      const now = performance.now();
      const gap = now - prev;
      prev = now;

      if (gap > 34) {
        recordHomeMotionDuration('frame-gap', 'home-feed-frame-gap', gap, {
          pathname: '/home',
        });
      }

      if (now - start < 10000) {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [clientMounted]);

  /** เฟรมแรกหลัง hydrate: อย่า return null — จะเห็นพื้นขาวก่อนโฮมโผล่ */
  if (!clientMounted) {
    return (
      <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
        <div>
          <div ref={recommendPanelRef} style={{ display: 'block' }} aria-hidden={false}>
            <FeedSkeleton count={3} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <HomePagePanels
        feedRestoreWrapRef={feedRestoreWrapRef}
        recommendPanelRef={recommendPanelRef}
        soldPanelRef={soldPanelRef}
        isSoldTabNoSearch={isSoldTabNoSearch}
        showFeedSkeleton={showFeedSkeleton}
        searchWaitingResults={searchWaitingResults}
        hasSearch={hasSearch}
        searchDataLoading={searchDataLoading}
        tab={tab}
        onPrefetchNextPost={onPrefetchNextPost}
        recommendPostFeedProps={recommendPostFeedProps}
        soldTabProps={soldTabProps}
      />
      <HomePageModals
        effectiveSession={effectiveSession}
        fullScreenViewer={fullScreenViewer}
        handlers={handlers}
        headerScroll={headerScroll}
        isSoldTabNoSearch={isSoldTabNoSearch}
        isSubmittingReport={isSubmittingReport}
        reportReason={reportReason}
        reportingPost={reportingPost}
        setReportReason={setReportReason}
        setReportingPost={setReportingPost}
        soldReportSubmitRef={soldTabProps.handleSubmitReportRef}
        viewingPostHook={viewingPostHook}
      />
    </main>
  );
}
