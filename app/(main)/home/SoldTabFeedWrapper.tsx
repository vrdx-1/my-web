'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UsePostListDataReturn } from '@/hooks/usePostListData';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useMenu } from '@/hooks/useMenu';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { HomeFeedBody } from './HomeFeedBody';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

export type SoldTabFeedWrapperProps = {
  /** ข้อมูล feed แท็บขายแล้วจากหน้าหลัก — เก็บไว้ไม่หายเมื่อสลับแท็บ */
  soldListData: UsePostListDataReturn;
  menu: ReturnType<typeof useMenu>;
  viewingPostHook: ReturnType<typeof useViewingPost>;
  headerScroll: ReturnType<typeof useHeaderScroll>;
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
};

/** แสดง feed แท็บขายแล้ว — รับข้อมูลจากหน้าหลัก เพื่อให้สลับแท็บแล้วแสดงทันทีโดยไม่โหลดใหม่ */
export function SoldTabFeedWrapper({
  soldListData,
  menu,
  viewingPostHook,
  headerScroll,
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
}: SoldTabFeedWrapperProps) {
  /** แสดงแถว skeleton โหลดเพิ่มทันทีที่ sentinel ยิง setPage — ก่อน loadingMore จาก API */
  const [soldLoadMoreShell, setSoldLoadMoreShell] = useState(false);
  const effectiveLoadingMore = soldListData.loadingMore || soldLoadMoreShell;

  const handleSoldLoadMore = useCallback(() => {
    if (soldListData.loadingMore || soldLoadMoreShell || !soldListData.hasMore) return;
    setSoldLoadMoreShell(true);
    soldListData.setPage((p) => p + 1);
  }, [soldListData.loadingMore, soldLoadMoreShell, soldListData.hasMore, soldListData.setPage]);

  useEffect(() => {
    if (soldListData.loadingMore) setSoldLoadMoreShell(false);
  }, [soldListData.loadingMore]);

  useEffect(() => {
    if (!soldListData.hasMore || !isActive) {
      setSoldLoadMoreShell(false);
    }
  }, [soldListData.hasMore, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (soldListData.page === 0) return;
    if (soldListData.loadingMore) return;
    if (soldListData.session === undefined) return;
    if (!soldListData.hasMore) return;
    soldListData.fetchPosts(false, soldListData.page);
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
    const t = window.setTimeout(() => setSoldLoadMoreShell(false), 8000);
    return () => clearTimeout(t);
  }, [soldLoadMoreShell]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    enabled: isActive,
    loadingMore: effectiveLoadingMore,
    hasMore: soldListData.hasMore,
    onLoadMore: handleSoldLoadMore,
  });

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
    headerScroll,
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

  const showSkeleton = soldListData.posts.length === 0 && soldListData.loadingMore;

  return (
    <>
      <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
        <HomeFeedBody
          showSkeleton={showSkeleton}
          skeletonCount={3}
          postFeedProps={{
            posts: soldListData.posts,
            session: soldListData.session,
            savedPosts: soldListData.savedPosts,
            justSavedPosts,
            activeMenuState: menu.activeMenuState,
            isMenuAnimating: menu.isMenuAnimating,
            lastPostElementRef,
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
      </div>
      {handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}
      {handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
        />
      )}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
      {handlers.showRepostSuccess && (
        <SuccessPopup message="ໂພສໃໝ່ສຳເລັດ" onClose={() => handlers.setShowRepostSuccess?.(false)} />
      )}
    </>
  );
}
