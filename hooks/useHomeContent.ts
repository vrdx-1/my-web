'use client'

import { useState, useDeferredValue, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useHomeData } from '@/hooks/useHomeData';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMenu } from '@/hooks/useMenu';
import { usePostModals } from '@/hooks/usePostModals';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useRegistrationSuccess } from '@/hooks/useRegistrationSuccess';
import { useHomeHandlers } from '@/hooks/useHomeHandlers';
import { useHomeSearch } from '@/hooks/useHomeSearch';
import { useHomeBackHandlers } from '@/hooks/useHomeBackHandlers';
import { usePostFeedModalsProps } from '@/hooks/usePostFeedModalsProps';
import { useHomeEffects } from '@/hooks/useHomeEffects';
import { useHomeInteractions } from '@/hooks/useHomeInteractions';
import { usePostFeedProps } from '@/hooks/usePostFeedProps';
import { useHomeModals } from '@/hooks/useHomeModals';
import { useHomePopups } from '@/hooks/useHomePopups';

/**
 * Mega hook สำหรับหน้า Home
 * รวม hooks ทั้งหมดเข้าด้วยกันเพื่อลดความซับซ้อนของ HomeContent
 */
export function useHomeContent() {
  const router = useRouter();
  
  // Search
  const search = useHomeSearch();
  const deferredSearchTerm = useDeferredValue(search.debouncedSearchTerm);
  
  // State
  const [uiState, setUIState] = useState({
    justLikedPosts: {} as { [key: string]: boolean },
    justSavedPosts: {} as { [key: string]: boolean },
    tabRefreshing: false,
    hasInitialFetchCompleted: false,
    reportState: {
      reportingPost: null as any | null,
      reportReason: '',
      isSubmittingReport: false,
    },
  });
  
  // Data hooks
  const homeData = useHomeData(deferredSearchTerm);
  const { unreadCount } = useUnreadNotificationCount({ userId: homeData.session?.user?.id });
  
  // Memoize setters เพื่อป้องกัน infinite re-render loop
  const setTabRefreshing = useCallback((refreshing: boolean) => {
    setUIState(prev => ({ ...prev, tabRefreshing: refreshing }));
  }, []);
  
  const setHasInitialFetchCompleted = useCallback((completed: boolean) => {
    setUIState(prev => ({ ...prev, hasInitialFetchCompleted: completed }));
  }, []);
  
  // Effects
  useHomeEffects({
    loadingMore: homeData.loadingMore,
    setTabRefreshing,
    setHasInitialFetchCompleted,
  });
  
  // UI hooks
  const viewingPostHook = useViewingPost();
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const interactionModalHook = useInteractionModal();
  const { showRegistrationSuccess, setShowRegistrationSuccess } = useRegistrationSuccess();
  const fileUpload = useFileUpload();
  
  // Infinite scroll — โหลดเมื่อใกล้ถึงโพสสุดท้าย (threshold 0 = เห็นนิดเดียวก็โหลด, rootMargin ล่าง 800px = โหลดล่วงหน้า)
  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: homeData.loadingMore,
    hasMore: homeData.hasMore,
    onLoadMore: () => homeData.setPage(prevPage => prevPage + 1),
    threshold: 0,
    rootMargin: '0px 0px 800px 0px',
  });
  
  // Handlers
  const handlers = useHomeHandlers({
    homeData,
    fileUpload,
    router,
    setIsSearchScreenOpen: search.setIsSearchScreenOpen,
    setTabRefreshing,
  });
  
  // Post modals side effects
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
    setIsHeaderVisible: () => {},
  });
  
  // Interactions
  const { handleViewLikes, handleViewSaves, fetchInteractions } = useHomeInteractions({
    interactionModalHook,
    posts: homeData.posts,
  });
  
  // Post interactions
  const { toggleLike, toggleSave } = usePostInteractions({
    session: homeData.session,
    posts: homeData.posts,
    setPosts: homeData.setPosts,
    likedPosts: homeData.likedPosts,
    savedPosts: homeData.savedPosts,
    setLikedPosts: homeData.setLikedPosts,
    setSavedPosts: homeData.setSavedPosts,
    setJustLikedPosts: (posts) => setUIState(prev => ({ ...prev, justLikedPosts: posts })),
    setJustSavedPosts: (posts) => setUIState(prev => ({ ...prev, justSavedPosts: posts })),
  });
  
  // Post feed handlers
  const postFeedHandlers = usePostFeedHandlers({
    session: homeData.session,
    posts: homeData.posts,
    setPosts: homeData.setPosts,
    viewingPostHook,
    menu,
    reportingPost: uiState.reportState.reportingPost,
    setReportingPost: (post) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, reportingPost: post }
    })),
    reportReason: uiState.reportState.reportReason,
    setReportReason: (reason) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, reportReason: reason }
    })),
    isSubmittingReport: uiState.reportState.isSubmittingReport,
    setIsSubmittingReport: (submitting) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, isSubmittingReport: submitting }
    })),
  });
  
  // Props hooks
  const postFeedProps = usePostFeedProps({
    posts: homeData.posts,
    session: homeData.session,
    likedPosts: homeData.likedPosts,
    savedPosts: homeData.savedPosts,
    justLikedPosts: uiState.justLikedPosts,
    justSavedPosts: uiState.justSavedPosts,
    activeMenuState: menu.activeMenuState,
    isMenuAnimating: menu.isMenuAnimating,
    lastPostElementRef,
    menuButtonRefs: menu.menuButtonRefs,
    menu,
    postFeedHandlers,
    toggleLike,
    toggleSave,
    handleViewLikes,
    handleViewSaves,
    loadingMore: homeData.loadingMore,
    hasMore: homeData.hasMore,
    onLoadMore: () => homeData.setPage((prev) => prev + 1),
  });
  
  const postFeedModalsPropsRaw = usePostFeedModalsProps({
    viewingPostHook,
    fullScreenViewer,
    posts: homeData.posts,
    reportingPost: uiState.reportState.reportingPost,
    setReportingPost: (post) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, reportingPost: post }
    })),
    reportReason: uiState.reportState.reportReason,
    setReportReason: (reason) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, reportReason: reason }
    })),
    isSubmittingReport: uiState.reportState.isSubmittingReport,
    setIsSubmittingReport: (submitting) => setUIState(prev => ({
      ...prev,
      reportState: { ...prev.reportState, isSubmittingReport: submitting }
    })),
    handleSubmitReport: postFeedHandlers.handleSubmitReport,
  });
  
  const { interactionModalProps, postFeedModalsProps } = useHomeModals({
    interactionModalHook,
    postFeedModalsProps: postFeedModalsPropsRaw,
    session: homeData.session,
  });
  
  const popups = useHomePopups({
    postFeedHandlers,
    showRegistrationSuccess,
    setShowRegistrationSuccess,
  });
  
  // Back handlers
  useHomeBackHandlers({
    fullScreenViewer,
    viewingPostHook,
  });
  
  return {
    // Search
    searchTerm: search.searchTerm,
    setSearchTerm: search.setSearchTerm,
    isSearchScreenOpen: search.isSearchScreenOpen,
    setIsSearchScreenOpen: search.setIsSearchScreenOpen,
    
    // Data
    homeData,
    unreadCount,
    hasInitialFetchCompleted: uiState.hasInitialFetchCompleted,
    
    // Handlers
    handlers,
    fetchInteractions,
    
    // Props
    postFeedProps,
    interactionModalProps,
    postFeedModalsProps,
    popups,
    
    // UI state
    tabRefreshing: uiState.tabRefreshing,
    fileUpload,
  };
}
