'use client'

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useViewingPost } from './useViewingPost';
import { useHeaderScroll } from './useHeaderScroll';
import { useMenu } from './useMenu';
import { togglePostStatus, deletePost, openReportModal, submitReport, sharePost } from '@/utils/postManagement';

interface UsePostFeedHandlersProps {
  session: any;
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  viewingPostHook: ReturnType<typeof useViewingPost>;
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
  viewingPostHook,
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

  const handleViewPost = useCallback(
    async (post: any, imageIndex: number = 0) => {
      const onClose = headerScroll?.setIsHeaderVisible || (() => {});
      await viewingPostHook.handleViewPost(post, imageIndex, setPosts, onClose);
    },
    [viewingPostHook, setPosts, headerScroll]
  );

  const handleTogglePostStatus = useCallback(
    (postId: string, currentStatus: string) => {
      togglePostStatus(postId, currentStatus, setPosts);
    },
    [setPosts]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      await deletePost(postId, setPosts);
      menu?.setActiveMenu(null);
    },
    [setPosts, menu]
  );

  const handleReport = useCallback(
    (post: any) => {
      if (setReportingPost) {
        openReportModal(post, session, setReportingPost);
        menu?.setActiveMenu(null);
      }
    },
    [session, setReportingPost, menu]
  );

  const handleSubmitReport = useCallback(() => {
    if (!reportingPost || !setReportingPost || !setReportReason || !setIsSubmittingReport) return;
    submitReport(
      reportingPost,
      reportReason || '',
      session,
      setReportingPost,
      setReportReason,
      setIsSubmittingReport
    );
  }, [reportingPost, reportReason, session, setReportingPost, setReportReason, setIsSubmittingReport]);

  const handleShare = useCallback(
    async (post: any) => {
      await sharePost(post, session, setPosts);
    },
    [session, setPosts]
  );

  return {
    handleViewPost,
    handleTogglePostStatus,
    handleDeletePost,
    handleReport,
    handleSubmitReport,
    handleShare,
  };
}
