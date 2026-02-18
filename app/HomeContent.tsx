'use client'

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PostFeed } from '@/components/PostFeed';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';

// Lazy load heavy modals
const PostFeedModals = dynamic(() => import('@/components/PostFeedModals').then(m => ({ default: m.PostFeedModals })), { ssr: false });
const InteractionModal = dynamic(() => import('@/components/modals/InteractionModal').then(m => ({ default: m.InteractionModal })), { ssr: false });
const ReportSuccessPopup = dynamic(() => import('@/components/modals/ReportSuccessPopup').then(m => ({ default: m.ReportSuccessPopup })), { ssr: false });
const SuccessPopup = dynamic(() => import('@/components/modals/SuccessPopup').then(m => ({ default: m.SuccessPopup })), { ssr: false });
const DeleteConfirmModal = dynamic(() => import('@/components/modals/DeleteConfirmModal').then(m => ({ default: m.DeleteConfirmModal })), { ssr: false });

export function HomeContent() {
  const mainTab = useMainTabContext();
  const {
    homeData,
    hasInitialFetchCompleted,
    handlers,
    fetchInteractions,
    postFeedProps,
    interactionModalProps,
    postFeedModalsProps,
    popups,
    tabRefreshing,
    refreshSource,
    fileUpload,
    isInteractionModalOpen,
  } = useHomeContent({
    sharedSearchTerm: mainTab?.searchTerm,
    isSearchScreenOpen: mainTab?.isSearchScreenOpen ?? false,
    setSearchTerm: mainTab?.setSearchTerm,
    setIsSearchScreenOpen: mainTab?.setIsSearchScreenOpen,
  });

  const isPullRefreshing = tabRefreshing && refreshSource === 'pull';

  const handlePullToRefresh = useCallback(() => {
    if (mainTab) {
      mainTab.setTabRefreshing(true);
      mainTab.setRefreshSource('pull');
    }
    handlers.handlePullToRefresh();
  }, [mainTab, handlers.handlePullToRefresh]);

  const { pullDistance } = usePullToRefresh(
    handlePullToRefresh,
    tabRefreshing || isInteractionModalOpen,
  );

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
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
      <main
        style={{ width: '100%', margin: '0', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}
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
