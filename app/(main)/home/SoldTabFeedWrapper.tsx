'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
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
  justLikedPosts: { [key: string]: boolean };
  setJustLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  justSavedPosts: { [key: string]: boolean };
  setJustSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchInteractions: (type: 'likes' | 'saves', postId: string) => Promise<void>;
  postsRef: React.MutableRefObject<any[]>;
  handleSubmitReportRef: React.MutableRefObject<(() => void) | null>;
  /** มือถือ iPhone โฮม: sentinel โหลดเพิ่มอิงกล่องเลื่อนภายใน */
  infiniteScrollRootRef?: RefObject<HTMLElement | null>;
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
  justLikedPosts,
  setJustLikedPosts,
  justSavedPosts,
  setJustSavedPosts,
  fetchInteractions,
  postsRef,
  handleSubmitReportRef,
  infiniteScrollRootRef,
}: SoldTabFeedWrapperProps) {
  /** แสดงแถว skeleton โหลดเพิ่มทันทีที่ sentinel ยิง setPage — ก่อน loadingMore จาก API */
  const [soldLoadMoreShell, setSoldLoadMoreShell] = useState(false);

  const handleSoldLoadMore = useCallback(() => {
    setSoldLoadMoreShell(true);
    soldListData.setPage((p) => p + 1);
  }, [soldListData.setPage]);

  useEffect(() => {
    if (soldListData.loadingMore) setSoldLoadMoreShell(false);
  }, [soldListData.loadingMore]);

  useEffect(() => {
    if (!soldLoadMoreShell) return;
    const t = window.setTimeout(() => setSoldLoadMoreShell(false), 8000);
    return () => clearTimeout(t);
  }, [soldLoadMoreShell]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: soldListData.loadingMore,
    hasMore: soldListData.hasMore,
    onLoadMore: handleSoldLoadMore,
    rootRef: infiniteScrollRootRef,
  });

  const { toggleLike, toggleSave } = usePostInteractions({
    session: soldListData.session,
    posts: soldListData.posts,
    setPosts: soldListData.setPosts,
    likedPosts: soldListData.likedPosts,
    savedPosts: soldListData.savedPosts,
    setLikedPosts: soldListData.setLikedPosts,
    setSavedPosts: soldListData.setSavedPosts,
    setJustLikedPosts,
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
            likedPosts: soldListData.likedPosts,
            savedPosts: soldListData.savedPosts,
            justLikedPosts,
            justSavedPosts,
            activeMenuState: menu.activeMenuState,
            isMenuAnimating: menu.isMenuAnimating,
            lastPostElementRef,
            menuButtonRefs: menu.menuButtonRefs,
            onViewPost: handlers.handleViewPost,
            onImpression: handlers.handleImpression,
            onLike: toggleLike,
            onSave: toggleSave,
            onShare: handlers.handleShare,
            onViewLikes: (postId) => fetchInteractions('likes', postId),
            onViewSaves: (postId) => fetchInteractions('saves', postId),
            onTogglePostStatus: handlers.handleTogglePostStatus,
            onDeletePost: handlers.handleDeletePost,
            onReport: handlers.handleReport,
            onSetActiveMenu: menu.setActiveMenu,
            onSetMenuAnimating: menu.setIsMenuAnimating,
            loadingMore: soldListData.loadingMore || soldLoadMoreShell,
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
    </>
  );
}
