'use client';

import { useEffect, useState } from 'react';

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

export function HomePageContent() {
  // optimize hydration: ใช้ useState + useEffect เพื่อให้ skeleton แสดงจนกว่าจะ mount จริง
  const [clientMounted, setClientMounted] = useState(false);
  useEffect(() => { setClientMounted(true); }, []);

  const {
    effectiveSession,
    feedRestoreWrapRef,
    fullScreenViewer,
    handleLocalPostUpdate,
    handlers,
    hasSearch,
    isSoldTabActive,
    setHeaderVisibleFromScroll,
    isSoldTabNoSearch,
    isSubmittingReport,
    onPrefetchNextPost,
    recommendPanelRef,
    recommendPostFeedProps,
    reportReason,
    reportingPost,
    searchDataLoading,
    searchWaitingResults,
    selectedProvince,
    activeProfileId,
    authUserId,
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
    if (process.env.NODE_ENV !== 'development') return;
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
    // แสดง skeleton เต็มหน้าจอทันที (กันจอขาว)
    return (
      <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
        <FeedSkeleton count={3} />
      </main>
    );
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <HomePagePanels
        feedRestoreWrapRef={feedRestoreWrapRef}
        recommendPanelRef={recommendPanelRef}
        soldPanelRef={soldPanelRef}
        isSoldTabActive={isSoldTabActive}
        isSoldTabNoSearch={isSoldTabNoSearch}
        showFeedSkeleton={showFeedSkeleton}
        searchWaitingResults={searchWaitingResults}
        hasSearch={hasSearch}
        selectedProvince={selectedProvince}
        activeProfileId={activeProfileId}
        authUserId={authUserId}
        searchDataLoading={searchDataLoading}
        tab={tab}
        onPrefetchNextPost={onPrefetchNextPost}
        onLocalPostUpdate={handleLocalPostUpdate}
        recommendPostFeedProps={recommendPostFeedProps}
        soldTabProps={soldTabProps}
      />
      <HomePageModals
        effectiveSession={effectiveSession}
        fullScreenViewer={fullScreenViewer}
        handlers={handlers}
        setHeaderVisible={setHeaderVisibleFromScroll}
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
