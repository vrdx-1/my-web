'use client'

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PostFeed } from '@/components/PostFeed';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { usePullHeaderOffset } from '@/app/(main)/MainTabLayoutClient';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator, PULL_REFRESH_HEADER_HEIGHT } from '@/components/PullToRefreshIndicator';

// Lazy load heavy modals
const PostFeedModals = dynamic(() => import('@/components/PostFeedModals').then(m => ({ default: m.PostFeedModals })), { ssr: false });
const InteractionModal = dynamic(() => import('@/components/modals/InteractionModal').then(m => ({ default: m.InteractionModal })), { ssr: false });
const ReportSuccessPopup = dynamic(() => import('@/components/modals/ReportSuccessPopup').then(m => ({ default: m.ReportSuccessPopup })), { ssr: false });
const SuccessPopup = dynamic(() => import('@/components/modals/SuccessPopup').then(m => ({ default: m.SuccessPopup })), { ssr: false });
const DeleteConfirmModal = dynamic(() => import('@/components/modals/DeleteConfirmModal').then(m => ({ default: m.DeleteConfirmModal })), { ssr: false });

const SCROLL_TOP_THRESHOLD = 8;

export function HomeContent() {
  const pathname = usePathname();
  const mainTab = useMainTabContext();
  const headerVisibility = useHeaderVisibilityContext();
  const {
    homeData,
    hasInitialFetchCompleted,
    handlers,
    fetchInteractions,
    postFeedProps,
    interactionModalProps,
    postFeedModalsProps,
    popups,
    fileUpload,
    headerScroll,
    tabRefreshing,
    refreshSource,
    isInteractionModalOpen,
  } = useHomeContent({
    sharedSearchTerm: mainTab?.searchTerm,
    isSearchScreenOpen: mainTab?.isSearchScreenOpen ?? false,
    setSearchTerm: mainTab?.setSearchTerm,
    setIsSearchScreenOpen: mainTab?.setIsSearchScreenOpen,
    onHeaderVisibilityChange: (v) => headerVisibility?.setHeaderVisible(v),
  });

  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const atTop = typeof window !== 'undefined' && window.scrollY <= SCROLL_TOP_THRESHOLD;
      setIsAtTop(atTop);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (pathname !== '/') return;
    document.body.setAttribute('data-page', 'home');
    return () => document.body.removeAttribute('data-page');
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/' || !isAtTop) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    let touchStartY = 0;
    const MIN_PULL_THRESHOLD = 5;
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > SCROLL_TOP_THRESHOLD) return;
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY > SCROLL_TOP_THRESHOLD) return;
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > MIN_PULL_THRESHOLD) e.preventDefault();
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [pathname, isAtTop]);

  const handlePullToRefresh = useCallback(() => {
    mainTab?.setTabRefreshing(true);
    mainTab?.setRefreshSource?.('pull');
    handlers.handlePullToRefresh();
  }, [mainTab, handlers.handlePullToRefresh]);

  const pullDisabled = tabRefreshing || !!isInteractionModalOpen || !isAtTop;
  const { pullDistance } = usePullToRefresh(handlePullToRefresh, pullDisabled);
  const isPullRefreshing = tabRefreshing && refreshSource === 'pull';

  const pullOffsetCtx = usePullHeaderOffset();
  // ฟีดโยโย้ตามนิ้วตอนดึง; ปล่อยมือแล้วคงช่องสปินเนอร์จนโหลดเสร็จ ค่อยโยโย้กลับ
  useEffect(() => {
    if (!pullOffsetCtx) return;
    if (pullDistance > 0) {
      pullOffsetCtx.setPullHeaderOffset(pullDistance);
    } else if (isPullRefreshing) {
      pullOffsetCtx.setPullHeaderOffset(40);
    } else {
      pullOffsetCtx.setPullHeaderOffset(0);
    }
  }, [pullDistance, isPullRefreshing, pullOffsetCtx]);

  // ลงทะเบียน refresh กับ layout (กดแท็บพร้อมขายที่ active = refresh)
  useEffect(() => {
    if (!mainTab) return;
    const handler = () => {
      mainTab.setTabRefreshing(true);
      handlers.handleTabRefresh();
    };
    mainTab.registerTabRefreshHandler(handler);
    return () => mainTab.unregisterTabRefreshHandler();
  }, [mainTab, handlers.handleTabRefresh]);

  // เคลียร์ loading แท็บและ refresh source เมื่อโหลดเสร็จ (spinner ต้องหายไป)
  useEffect(() => {
    if (!homeData.loadingMore && mainTab) {
      mainTab.setTabRefreshing(false);
      mainTab.setRefreshSource(null);
    }
  }, [homeData.loadingMore, mainTab]);

  return (
    <>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isPullRefreshing}
        headerHeight={PULL_REFRESH_HEADER_HEIGHT}
      />
      <main
        style={{
          width: '100%',
          margin: '0',
          background: '#ffffff',
          backgroundColor: '#ffffff',
          minHeight: '100vh',
          fontFamily: LAO_FONT,
          position: 'relative',
          transform: pullOffsetCtx ? `translateY(${pullOffsetCtx.pullHeaderOffset}px)` : undefined,
          transition: pullOffsetCtx?.pullHeaderOffset === 0 ? 'transform 0.15s ease-out' : 'none',
        }}
      >
        <input type="file" ref={fileUpload.hiddenFileInputRef} multiple accept="image/*" onChange={fileUpload.handleFileChange} style={{ display: 'none' }} />

        {homeData.posts.length === 0 && (!hasInitialFetchCompleted || homeData.loadingMore) ? (
          <FeedSkeleton />
        ) : (
          <PostFeed {...postFeedProps} />
        )}

        <InteractionModal
          {...interactionModalProps}
          posts={homeData.posts}
          onFetchInteractions={fetchInteractions}
        />

        <PostFeedModals
          session={homeData.session}
          {...postFeedModalsProps}
        />

        {popups.showReportSuccess && (
          <ReportSuccessPopup onClose={popups.onCloseReportSuccess} />
        )}
        {popups.showDeleteConfirm && (
          <DeleteConfirmModal
            onConfirm={popups.onConfirmDelete ?? (() => {})}
            onCancel={popups.onCancelDelete ?? (() => {})}
          />
        )}
        {popups.showDeleteSuccess && (
          <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={popups.onCloseDeleteSuccess} />
        )}
        {popups.showRegistrationSuccess && (
          <SuccessPopup message="ສ້າງບັນຊີສຳເລັດ" onClose={popups.onCloseRegistrationSuccess} />
        )}
      </main>
    </>
  );
}
