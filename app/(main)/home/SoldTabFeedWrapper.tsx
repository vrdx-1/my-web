'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization, @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UsePostListDataReturn } from '@/hooks/usePostListData';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useMenu } from '@/hooks/useMenu';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { HomeFeedBody } from './HomeFeedBody';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

export type SoldTabFeedWrapperProps = {
  /** ข้อมูล feed แท็บขายแล้วจากหน้าหลัก — เก็บไว้ไม่หาย  เมื่อสลับแท็บ */
  soldListData: UsePostListDataReturn;
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
export function SoldTabFeedWrapper({
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
  const effectiveLoadingMore = soldListData.loadingMore || soldLoadMoreShell;

  // refs เพื่อกันการ recreate callback / effect ทุกครั้งที่ loading/hasMore เปลี่ยน
  const soldLoadingMoreRef = useRef(soldListData.loadingMore);
  soldLoadingMoreRef.current = soldListData.loadingMore;
  const soldHasMoreRef = useRef(soldListData.hasMore);
  soldHasMoreRef.current = soldListData.hasMore;
  const soldSessionRef = useRef(soldListData.session);
  soldSessionRef.current = soldListData.session;
  const soldFetchPostsRef = useRef(soldListData.fetchPosts);
  soldFetchPostsRef.current = soldListData.fetchPosts;

  const handleSoldLoadMore = useCallback(() => {
    if (soldLoadingMoreRef.current || soldLoadMoreShell || !soldHasMoreRef.current) return;
    setSoldLoadMoreShell(true);
    soldListData.setPage((p) => p + 1);
  }, [soldLoadMoreShell, soldListData.setPage]);

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
    if (soldLoadingMoreRef.current) return;
    if (soldSessionRef.current === undefined) return;
    if (!soldHasMoreRef.current) return;
    soldFetchPostsRef.current(false);
  }, [
    isActive,
    soldListData.page,
    // loadingMore/hasMore/session/fetchPosts ถูกอ่านผ่าน ref แทน deps
    // เพื่อกัน effect re-fire ทุกครั้งที่ loading state เปลี่ยน
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

  const showSkeleton = soldListData.posts.length === 0 && (soldListData.loadingMore || isRefreshing);

  return (
    <>
      <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
        <HomeFeedBody
          showSkeleton={showSkeleton}
          skeletonCount={3}
            gateImageReady={isActive && !isRefreshing}
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
