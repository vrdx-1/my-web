'use client';

import { useEffect } from 'react';
import { usePostListData } from '@/hooks/usePostListData';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useHomeLikedSaved } from '@/hooks/useHomeLikedSaved';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { useMenu } from '@/hooks/useMenu';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { HomeFeedBody } from './HomeFeedBody';

export type SoldTabFeedWrapperProps = {
  session: any;
  sessionReady: boolean;
  sharedLikedSaved: ReturnType<typeof useHomeLikedSaved>;
  soldTabRefreshRef: React.MutableRefObject<{
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
  } | null>;
  onLoadingMoreChange: (loading: boolean) => void;
  onPostsChange: (posts: any[]) => void;
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
};

/** โหลดข้อมูลแท็บขายแล้วเฉพาะเมื่อเปิดแท็บนี้ (lazy) — ลดงานตอนโหลดหน้าโฮม */
export function SoldTabFeedWrapper({
  session,
  sessionReady,
  sharedLikedSaved,
  soldTabRefreshRef,
  onLoadingMoreChange,
  onPostsChange,
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
}: SoldTabFeedWrapperProps) {
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    status: 'sold',
    sharedLikedSaved,
  });

  useEffect(() => {
    soldTabRefreshRef.current = {
      setPage: soldListData.setPage,
      setHasMore: soldListData.setHasMore,
      fetchPosts: soldListData.fetchPosts,
    };
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
    return () => {
      soldTabRefreshRef.current = null;
    };
  }, []);

  useEffect(() => {
    onLoadingMoreChange(soldListData.loadingMore);
  }, [soldListData.loadingMore, onLoadingMoreChange]);

  useEffect(() => {
    onPostsChange(soldListData.posts);
  }, [soldListData.posts, onPostsChange]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: soldListData.loadingMore,
    hasMore: soldListData.hasMore,
    onLoadMore: () => soldListData.setPage((p) => p + 1),
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
            loadingMore: soldListData.hasMore ? soldListData.loadingMore : false,
            hasMore: soldListData.hasMore ?? true,
            onLoadMore: () => soldListData.setPage((p) => p + 1),
            hideBoost: true,
            isFeedScrollIdle: true,
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
