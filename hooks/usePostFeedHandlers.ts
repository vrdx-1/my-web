'use client'

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useViewingPost } from './useViewingPost';
import { useHeaderScroll } from './useHeaderScroll';
import { useMenu } from './useMenu';
import { supabase } from '@/lib/supabase';
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
  const impressionRecordedRef = useRef<Set<string>>(new Set());

  const handleImpression = useCallback((postId: string) => {
    if (impressionRecordedRef.current.has(postId)) return;
    impressionRecordedRef.current.add(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, views: (p.views || 0) + 1 } : p))
    );
    const rpcPromise = supabase.rpc('increment_views', { post_id: postId });
    Promise.resolve(rpcPromise).then((res) => {
      if (res?.error) throw res.error;
    }).catch(async () => {
      const { data } = await supabase.from('cars').select('views').eq('id', postId).single();
      await supabase.from('cars').update({ views: (data?.views ?? 0) + 1 }).eq('id', postId);
    });
  }, [setPosts]);

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
      await deletePost(postToDelete, setPosts);
      setShowDeleteConfirm(false);
      setPostToDelete(null);
      setShowDeleteSuccess(true);
    },
    [postToDelete, setPosts]
  );

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setPostToDelete(null);
  }, []);

  const handleReport = useCallback(
    (post: any) => {
      if (setReportingPost) {
        openReportModal(post, session, setReportingPost);
        menu?.setActiveMenu(null);
      }
    },
    [session, setReportingPost, menu]
  );

  const [showReportSuccess, setShowReportSuccess] = useState(false);

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

  return {
    handleViewPost,
    handleImpression,
    handleTogglePostStatus,
    handleDeletePost,
    handleReport,
    handleSubmitReport,
    handleShare,
    showDeleteConfirm,
    handleConfirmDelete,
    handleCancelDelete,
    showDeleteSuccess,
    setShowDeleteSuccess,
    showReportSuccess,
    setShowReportSuccess,
  };
}
