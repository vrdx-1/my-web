'use client';

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { memo, useEffect, useRef, useState } from 'react';
import type { UseSoldPostListDataReturn } from '@/hooks/useSoldPostListData';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useMenu } from '@/hooks/useMenu';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { HomeFeedBody } from './HomeFeedBody';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

export type SoldTabFeedWrapperProps = {
  /** ข้อมูล feed แท็บขายแล้วจากหน้าหลัก — เก็บไว้ไม่หาย  เมื่อสลับแท็บ */
  soldListData: UseSoldPostListDataReturn;
  menu: ReturnType<typeof useMenu>;
  viewingPostHook: ReturnType<typeof useViewingPost>;
  setHeaderVisible: (visible: boolean) => void;
  fullScreenViewer: ReturnType<typeof useFullScreenViewer>;
  reportingPost: any;
  setReportingPost: (p: any) => void;
  reportReason: string;
  setReportReason: (r: string) => void;
  isSubmittingReport: boolean;
  setIsSubmittingReport: (v: boolean) => void;
  justSavedPosts: { [key: string]: boolean };
  setJustSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  handleSubmitReportRef: React.MutableRefObject<(() => void) | null>;
  isActive: boolean;
  isRefreshing: boolean;
};

/** แสดง feed แท็บขายแล้ว — รับข้อมูลจากหน้าหลัก เพื่อให้สลับแท็บแล้วแสดงทันทีโดยไม่โหลดใหม่ */
function SoldTabFeedWrapperBase({
  soldListData,
  menu,
  viewingPostHook,
  setHeaderVisible,
  fullScreenViewer,
  reportingPost,
  setReportingPost,
  reportReason,
  setReportReason,
  isSubmittingReport,
  setIsSubmittingReport,
  justSavedPosts,
  setJustSavedPosts,
  handleSubmitReportRef,
  isActive,
  isRefreshing,
}: SoldTabFeedWrapperProps) {
  /** แสดงแถว skeleton โหลดเพิ่มทันทีที่ sentinel ยิง setPage — ก่อน loadingMore จาก API */
  const [soldLoadMoreShell, setSoldLoadMoreShell] = useState(false);
  const loadMoreRequestLockedRef = useRef(false);
  const loadMoreSawNetworkRef = useRef(false);
  const effectiveLoadingMore = soldListData.loadingMore || soldLoadMoreShell;

  const handleSoldLoadMore = () => {
    if (loadMoreRequestLockedRef.current) return;
    if (soldListData.loadingMore || soldLoadMoreShell || !soldListData.hasMore) return;

    loadMoreRequestLockedRef.current = true;
    loadMoreSawNetworkRef.current = false;
    setSoldLoadMoreShell(true);
    soldListData.setPage((p) => p + 1);
  };
  useEffect(() => {
    if (soldListData.loadingMore) {
      loadMoreSawNetworkRef.current = true;
      setSoldLoadMoreShell(false);
      return;
    }

    // Unlock only after we have observed a full request cycle (loadingMore true -> false)
    if (loadMoreRequestLockedRef.current && loadMoreSawNetworkRef.current) {
      loadMoreRequestLockedRef.current = false;
      loadMoreSawNetworkRef.current = false;
    }
  }, [soldListData.loadingMore]);

  useEffect(() => {
    if (!soldListData.hasMore || !isActive) {
      loadMoreRequestLockedRef.current = false;
      loadMoreSawNetworkRef.current = false;
      setSoldLoadMoreShell(false);
    }
  }, [soldListData.hasMore, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (soldListData.page === 0) return;
    if (soldListData.loadingMore) return;
    if (soldListData.session === undefined) return;
    if (!soldListData.hasMore) return;
    soldListData.fetchPosts(false);
  }, [
    isActive,
    soldListData.page,
    soldListData.loadingMore,
    soldListData.session,
    soldListData.hasMore,
    soldListData.fetchPosts,
  ]);
  useEffect(() => {
    if (!soldLoadMoreShell) return;
    const t = window.setTimeout(() => {
      loadMoreRequestLockedRef.current = false;
      loadMoreSawNetworkRef.current = false;
      setSoldLoadMoreShell(false);
    }, 8000);
    return () => clearTimeout(t);
  }, [soldLoadMoreShell]);

  const { toggleSave } = usePostInteractions({
    session: soldListData.session,
    posts: soldListData.posts,
    setPosts: soldListData.setPosts,
    savedPosts: soldListData.savedPosts,
    setSavedPosts: soldListData.setSavedPosts,
    setJustSavedPosts,
  });

  const handlers = usePostFeedHandlers({
    session: soldListData.session,
    posts: soldListData.posts,
    setPosts: soldListData.setPosts,
    viewingPostHook,
    setHeaderVisible,
    menu,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
  });

  useEffect(() => {
    handleSubmitReportRef.current = handlers.handleSubmitReport;
  }, [handlers.handleSubmitReport]);

  const { lastElementRef: soldLastPostElementRef } = useInfiniteScroll({
    enabled: isActive,
    loadingMore: effectiveLoadingMore,
    hasMore: soldListData.hasMore ?? true,
    onLoadMore: handleSoldLoadMore,
    feedPostCount: soldListData.posts.length,
  });

  const showSkeleton = soldListData.posts.length === 0 && (soldListData.loadingMore || isRefreshing);

  return (
    <>
      <HomeFeedBody
        showSkeleton={showSkeleton}
        forceSkeletonWhenEmpty={false}
        mayShowEmptyState={true}
        isSearchLoading={false}
        skeletonCount={3}
        gateImageReady={false}
        enableViewportTracking={false}
        postFeedProps={{
          posts: soldListData.posts,
          session: soldListData.session,
          savedPosts: soldListData.savedPosts,
          justSavedPosts,
          activeMenuState: menu.activeMenuState,
          isMenuAnimating: menu.isMenuAnimating,
          lastPostElementRef: soldLastPostElementRef,
          menuButtonRefs: menu.menuButtonRefs,
          onViewPost: handlers.handleViewPost,
          onSave: toggleSave,
          onShare: handlers.handleShare,
          onTogglePostStatus: handlers.handleTogglePostStatus,
          onDeletePost: handlers.handleDeletePost,
          onReport: handlers.handleReport,
          onRepost: handlers.handleRepost,
          onSetActiveMenu: menu.setActiveMenu,
          onSetMenuAnimating: menu.setIsMenuAnimating,
          loadingMore: effectiveLoadingMore,
          hasMore: soldListData.hasMore ?? true,
          onLoadMore: handleSoldLoadMore,
          hideBoost: true,
        }}
      />
      {handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}
      {handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
          loading={handlers.isDeletingPost}
        />
      )}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
      {handlers.showRepostSuccess && (
        <SuccessPopup message="ໂພສໃໝ່ສຳເລັດ" onClose={() => handlers.setShowRepostSuccess?.(false)} />
      )}
      {handlers.showToggleStatusSuccess && (
        <SuccessPopup message="ສຳເລັດ" onClose={() => handlers.setShowToggleStatusSuccess?.(false)} />
      )}
    </>
  );
}
export const SoldTabFeedWrapper = memo(SoldTabFeedWrapperBase);