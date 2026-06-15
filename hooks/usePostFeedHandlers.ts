'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useViewingPost } from './useViewingPost';
import { useHeaderScroll } from './useHeaderScroll';
import { useMenu } from './useMenu';
import { togglePostStatus, deletePost, openReportModal, submitReport, sharePost, repostPost } from '@/utils/postManagement';
import { REGISTER_PATH } from '@/utils/authRoutes';

interface UsePostFeedHandlersProps {
  session: any;
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  repostOptions?: {
    reorderToTop?: boolean;
    onSuccess?: (payload: { postId: string; post: any }) => void;
  };
  viewingPostHook: ReturnType<typeof useViewingPost>;
  setHeaderVisible?: (visible: boolean) => void;
  headerScroll?: ReturnType<typeof useHeaderScroll>;
  menu?: ReturnType<typeof useMenu>;
  reportingPost?: any | null;
  setReportingPost?: (post: any | null) => void;
  reportReason?: string;
  setReportReason?: (reason: string) => void;
  isSubmittingReport?: boolean;
  setIsSubmittingReport?: (submitting: boolean) => void;
}

/**
 * usePostFeedHandlers Hook
 * Centralizes common post feed handlers used across multiple pages
 */
export function usePostFeedHandlers({
  session,
  posts,
  setPosts,
  repostOptions,
  viewingPostHook,
  setHeaderVisible,
  headerScroll,
  menu,
  reportingPost,
  setReportingPost,
  reportReason,
  setReportReason,
  isSubmittingReport,
  setIsSubmittingReport,
}: UsePostFeedHandlersProps) {
  const router = useRouter();

  // ใช้ ref แทน posts ใน deps ของ callbacks — ป้องกัน cascade recreation ทุกครั้ง posts array เปลี่ยน
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const handleViewPost = useCallback(
    async (post: any, imageIndex: number = 0) => {
      const onClose = setHeaderVisible || headerScroll?.setIsHeaderVisible || (() => {});
      await viewingPostHook.handleViewPost(post, imageIndex, setPosts, onClose);
    },
    [viewingPostHook, setPosts, setHeaderVisible, headerScroll]
  );

  const handleTogglePostStatus = useCallback(
    (postId: string, currentStatus: string) => {
      const postToRestore = postsRef.current.find((p) => p.id === postId);
      return togglePostStatus(postId, currentStatus, setPosts, postToRestore);
    },
    [setPosts]
  );

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const handleDeletePost = useCallback(
    (postId: string) => {
      setPostToDelete(postId);
      setShowDeleteConfirm(true);
      menu?.setActiveMenu(null);
    },
    [menu]
  );

  const handleConfirmDelete = useCallback(
    async () => {
      if (!postToDelete) return;
      try {
        await deletePost(postToDelete, setPosts);
        setShowDeleteConfirm(false);
        setPostToDelete(null);
        setShowDeleteSuccess(true);
      } catch (error: any) {
        const message = String(error?.message || '').trim();
        window.alert(message || 'ລົບໂພສບໍ່ສຳເລັດ');
      }
    },
    [postToDelete, setPosts]
  );

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setPostToDelete(null);
  }, []);

  const handleReport = useCallback(
    (post: any) => {
      if (!session) {
        menu?.setActiveMenu(null);
        router.push(REGISTER_PATH);
        return;
      }
      if (setReportingPost) {
        openReportModal(post, session, setReportingPost);
        menu?.setActiveMenu(null);
      }
    },
    [session, setReportingPost, menu, router]
  );

  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [showRepostSuccess, setShowRepostSuccess] = useState(false);

  const handleSubmitReport = useCallback(async () => {
    if (!reportingPost || !setReportingPost || !setReportReason || !setIsSubmittingReport) return;
    const success = await submitReport(
      reportingPost,
      reportReason || '',
      session,
      setReportingPost,
      setReportReason,
      setIsSubmittingReport
    );
    if (success) {
      setShowReportSuccess(true);
    }
  }, [reportingPost, reportReason, session, setReportingPost, setReportReason, setIsSubmittingReport]);

  const handleShare = useCallback(
    async (post: any) => {
      await sharePost(post, session, setPosts);
    },
    [session, setPosts]
  );

  const handleRepost = useCallback(
    async (postId: string) => {
      const postToRestore = postsRef.current.find((p) => String(p.id) === String(postId));
      if (!postToRestore || postToRestore.status !== 'recommend') return;
      await repostPost(postId, setPosts, postToRestore, {
        reorderToTop: repostOptions?.reorderToTop,
      });
      setShowRepostSuccess(true);
      repostOptions?.onSuccess?.({ postId, post: postToRestore });
    },
    [repostOptions, setPosts]
  );

  return useMemo(
    () => ({
      handleViewPost,
      handleTogglePostStatus,
      handleDeletePost,
      handleReport,
      handleSubmitReport,
      handleShare,
      handleRepost,
      showDeleteConfirm,
      handleConfirmDelete,
      handleCancelDelete,
      showDeleteSuccess,
      setShowDeleteSuccess,
      showReportSuccess,
      setShowReportSuccess,
      showRepostSuccess,
      setShowRepostSuccess,
    }),
    [
      handleViewPost,
      handleTogglePostStatus,
      handleDeletePost,
      handleReport,
      handleSubmitReport,
      handleShare,
      handleRepost,
      showDeleteConfirm,
      handleConfirmDelete,
      handleCancelDelete,
      showDeleteSuccess,
      showReportSuccess,
      showRepostSuccess,
    ],
  );
}
