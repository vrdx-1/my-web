'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useMenu } from '@/hooks/useMenu';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { usePostModals } from '@/hooks/usePostModals';
import { useBackHandler } from '@/components/BackHandlerContext';

export function useNotificationDetail(id: string | undefined) {
  const [post, setPost] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [boostInfo, setBoostInfo] = useState<{ status: string; expiresAt: string | null } | null>(null);
  const [showBoostDetails, setShowBoostDetails] = useState(false);

  const menu = useMenu();
  const viewingPostHook = useViewingPost();
  const fullScreenViewer = useFullScreenViewer();
  const headerScroll = useHeaderScroll();
  const interactionModalHook = useInteractionModal();

  const posts = post ? [post] : [];
  const setPostsFromSingle = useCallback((updater: React.SetStateAction<any[]>) => {
    setPost((prev: any) => {
      const list = prev ? [prev] : [];
      const next = typeof updater === 'function' ? updater(list) : updater;
      return next[0] ?? prev;
    });
  }, []);

  usePostModals({
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    setIsViewingModeOpen: viewingPostHook.setIsViewingModeOpen,
    setViewingModeDragOffset: viewingPostHook.setViewingModeDragOffset,
    initialImageIndex: viewingPostHook.initialImageIndex,
    savedScrollPosition: viewingPostHook.savedScrollPosition,
    fullScreenImages: fullScreenViewer.fullScreenImages,
    setFullScreenDragOffset: fullScreenViewer.setFullScreenDragOffset,
    setFullScreenVerticalDragOffset: fullScreenViewer.setFullScreenVerticalDragOffset,
    setFullScreenZoomScale: fullScreenViewer.setFullScreenZoomScale,
    setFullScreenZoomOrigin: fullScreenViewer.setFullScreenZoomOrigin,
    setFullScreenIsDragging: fullScreenViewer.setFullScreenIsDragging,
    setFullScreenTransitionDuration: fullScreenViewer.setFullScreenTransitionDuration,
    setFullScreenShowDetails: fullScreenViewer.setFullScreenShowDetails,
    interactionModalShow: interactionModalHook.interactionModal.show,
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
  });

  const { addBackStep } = useBackHandler();
  useEffect(() => {
    if (!fullScreenViewer.fullScreenImages) return;
    const close = () => {
      fullScreenViewer.setFullScreenImages(null);
      if (fullScreenViewer.activePhotoMenu != null) {
        fullScreenViewer.setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          fullScreenViewer.setActivePhotoMenu(null);
          fullScreenViewer.setIsPhotoMenuAnimating(false);
        }, 300);
      }
    };
    return addBackStep(close);
  }, [fullScreenViewer.fullScreenImages]);
  useEffect(() => {
    if (!viewingPostHook.viewingPost) return;
    return addBackStep(() => viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible));
  }, [viewingPostHook.viewingPost]);

  const fetchLikedStatus = useCallback(async (userIdOrToken: string, isUser: boolean) => {
    const table = isUser ? 'post_likes' : 'post_likes_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const map: { [key: string]: boolean } = {};
      data.forEach((item: { post_id: string }) => { map[item.post_id] = true; });
      setLikedPosts(map);
    }
  }, []);

  const fetchSavedStatus = useCallback(async (userIdOrToken: string, isUser: boolean) => {
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const map: { [key: string]: boolean } = {};
      data.forEach((item: { post_id: string }) => { map[item.post_id] = true; });
      setSavedPosts(map);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        fetchLikedStatus(s.user.id, true);
        fetchSavedStatus(s.user.id, true);
      } else {
        const token = getPrimaryGuestToken();
        fetchLikedStatus(token, false);
        fetchSavedStatus(token, false);
      }
    });
  }, [fetchLikedStatus, fetchSavedStatus]);

  const fetchPostDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from('cars').select('*, profiles!cars_user_id_fkey(*)').eq('id', id).single();
    setPost(data ?? null);
    setLoading(false);
  }, [id]);

  const fetchBoostInfo = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('post_boosts')
      .select('status, expires_at, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && data?.length) {
      const row = data[0] as any;
      setBoostInfo({ status: String(row.status), expiresAt: row.expires_at ?? null });
    } else {
      setBoostInfo(null);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPostDetail();
  }, [id, fetchPostDetail]);

  useEffect(() => {
    if (id) fetchBoostInfo();
  }, [id, fetchBoostInfo]);

  const { toggleLike, toggleSave } = usePostInteractions({
    session,
    posts,
    setPosts: setPostsFromSingle,
    likedPosts,
    savedPosts,
    setLikedPosts,
    setSavedPosts,
    setJustLikedPosts,
    setJustSavedPosts,
  });

  const handleTogglePostStatus = useCallback(async (postId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'recommend' ? 'sold' : 'recommend';
    const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', postId);
    if (!error) {
      setPost((prev: any) => (prev?.id === postId ? { ...prev, status: newStatus } : prev));
    }
  }, []);

  const handlers = usePostFeedHandlers({
    session,
    posts,
    setPosts: setPostsFromSingle,
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

  const fetchInteractions = useCallback(
    async (type: 'likes' | 'saves', postId: string) => {
      await interactionModalHook.fetchInteractions(type, postId, posts);
    },
    [interactionModalHook, posts],
  );

  const isBoostExpired =
    !!boostInfo &&
    boostInfo.status === 'success' &&
    !!boostInfo.expiresAt &&
    new Date(boostInfo.expiresAt).getTime() <= Date.now();

  return {
    post,
    session,
    loading,
    likedPosts,
    savedPosts,
    justLikedPosts,
    justSavedPosts,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    boostInfo,
    showBoostDetails,
    setShowBoostDetails,
    isBoostExpired,
    fetchBoostInfo,
    menu,
    viewingPostHook,
    fullScreenViewer,
    headerScroll,
    interactionModalHook,
    handlers,
    toggleLike,
    toggleSave,
    handleTogglePostStatus,
    fetchInteractions,
  };
}
