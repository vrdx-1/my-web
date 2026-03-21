'use client'

import { useCallback, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useViewingPost } from './useViewingPost';
import { useHeaderScroll } from './useHeaderScroll';
import { useMenu } from './useMenu';
import { supabase } from '@/lib/supabase';
import { togglePostStatus, deletePost, openReportModal, submitReport, sharePost } from '@/utils/postManagement';
import { REGISTER_PATH } from '@/utils/authRoutes';

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
  /** รวมการ +views เป็นชุดต่อ requestAnimationFrame — ไม่ให้ setPosts รั่วทุกครั้งที่ IntersectionObserver ยิง (ทำให้ทั้งฟีด + virtualizer re-render ถี่ๆ ตอนเลื่อนลึก) */
  const pendingViewIncrementsRef = useRef<Set<string>>(new Set());
  const flushViewRafRef = useRef<number | null>(null);

  const flushPendingViewIncrements = useCallback(() => {
    flushViewRafRef.current = null;
    const ids = pendingViewIncrementsRef.current;
    if (ids.size === 0) return;
    pendingViewIncrementsRef.current = new Set();
    startTransition(() => {
      setPosts((prev) =>
        prev.map((p) => {
          const id = String(p.id);
          if (!ids.has(id)) return p;
          return { ...p, views: (p.views || 0) + 1 };
        })
      );
    });
  }, [setPosts]);

  const handleImpression = useCallback(
    (postId: string) => {
      const key = String(postId);
      if (impressionRecordedRef.current.has(key)) return;
      impressionRecordedRef.current.add(key);
      pendingViewIncrementsRef.current.add(key);
      if (flushViewRafRef.current == null) {
        flushViewRafRef.current = requestAnimationFrame(() => {
          flushPendingViewIncrements();
        });
      }
      const rpcPromise = supabase.rpc('increment_views', { post_id: postId });
      Promise.resolve(rpcPromise).then((res) => {
        if (res?.error) throw res.error;
      }).catch(async () => {
        const { data } = await supabase.from('cars').select('views').eq('id', postId).single();
        await supabase.from('cars').update({ views: (data?.views ?? 0) + 1 }).eq('id', postId);
      });
    },
    [flushPendingViewIncrements],
  );

  const handleViewPost = useCallback(
    async (post: any, imageIndex: number = 0) => {
      const onClose = headerScroll?.setIsHeaderVisible || (() => {});
      await viewingPostHook.handleViewPost(post, imageIndex, setPosts, onClose);
    },
    [viewingPostHook, setPosts, headerScroll]
  );

  const handleTogglePostStatus = useCallback(
    (postId: string, currentStatus: string) => {
      const postToRestore = posts.find((p) => p.id === postId);
      return togglePostStatus(postId, currentStatus, setPosts, postToRestore);
    },
    [setPosts, posts]
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
