'use client'

import { useState, useDeferredValue, useCallback, useEffect, useRef } from 'react';
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
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useHomeModals } from '@/hooks/useHomeModals';
import { useHomePopups } from '@/hooks/useHomePopups';

export interface UseHomeContentOptions {
  /** เมื่อใช้ layout ร่วมกับ sold, ส่ง searchTerm จาก MainTabContext */
  sharedSearchTerm?: string;
  /** ใช้ commit คำค้นเมื่อปิดหน้าค้นหา เพื่อให้ feed refetch ทันที (ไม่รอ deferred) */
  isSearchScreenOpen?: boolean;
  setSearchTerm?: (v: string) => void;
  setIsSearchScreenOpen?: (v: boolean) => void;
}

/**
 * Mega hook สำหรับหน้า Home
 * รวม hooks ทั้งหมดเข้าด้วยกันเพื่อลดความซับซ้อนของ HomeContent
 */
export function useHomeContent(options?: UseHomeContentOptions) {
  const router = useRouter();
  const sharedSearchTerm = options?.sharedSearchTerm;
  const isSearchScreenOpen = options?.isSearchScreenOpen ?? false;
  const sharedSetSearchTerm = options?.setSearchTerm;
  const sharedSetIsSearchScreenOpen = options?.setIsSearchScreenOpen;

  // Search: ใช้ shared จาก layout หรือ local
  const search = useHomeSearch();
  const effectiveSearchTerm = sharedSearchTerm !== undefined ? sharedSearchTerm : search.debouncedSearchTerm;
  const deferredSearchTerm = useDeferredValue(effectiveSearchTerm);

  // เมื่อใช้ shared search: commit คำค้นเฉพาะตอนปิดหน้าค้นหา เพื่อให้หลังกดค้นหา feed refetch ทันที (ไม่รอ deferred)
  const [committedSearchTerm, setCommittedSearchTerm] = useState('');
  const prevCommittedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (sharedSearchTerm === undefined) return;
    if (!isSearchScreenOpen) setCommittedSearchTerm(sharedSearchTerm);
  }, [isSearchScreenOpen, sharedSearchTerm]);
  const searchTermForFetch =
    sharedSearchTerm !== undefined ? committedSearchTerm : deferredSearchTerm;

  // State
  const [uiState, setUIState] = useState({
    justLikedPosts: {} as { [key: string]: boolean },
    justSavedPosts: {} as { [key: string]: boolean },
    tabRefreshing: false,
    /** แหล่งที่มา refresh: 'pull' = ดึง feed (แสดง spinner ใหญ่), 'tab' = กดแท็บ (ไม่แสดง) */
    refreshSource: null as 'pull' | 'tab' | null,
    navigatingToTab: null as 'recommend' | 'sold' | null,
    hasInitialFetchCompleted: false,
    reportState: {
      reportingPost: null as any | null,
      reportReason: '',
      isSubmittingReport: false,
    },
  });

  // Data hooks
  const homeData = useHomeData(searchTermForFetch);
  const { unreadCount } = useUnreadNotificationCount({ userId: homeData.session?.user?.id });

  // หลังกดค้นหา (ปิดหน้าค้นหา) ให้ refetch feed ทันที ไม่รอ debounce 350ms
  useEffect(() => {
    if (sharedSearchTerm === undefined) return;
    const prev = prevCommittedRef.current;
    prevCommittedRef.current = committedSearchTerm;
    if (prev !== undefined && prev !== committedSearchTerm) {
      homeData.setPage(0);
      homeData.setHasMore(true);
      homeData.fetchPosts(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ต้องการรันเฉพาะเมื่อ commit คำค้นเปลี่ยน
  }, [committedSearchTerm, sharedSearchTerm]);

  // Memoize setters เพื่อป้องกัน infinite re-render loop
  const setTabRefreshing = useCallback((refreshing: boolean) => {
    setUIState(prev => ({ ...prev, tabRefreshing: refreshing }));
  }, []);

  const handleTabSwitchStart = useCallback((tab: 'recommend' | 'sold') => {
    setUIState(prev => ({ ...prev, navigatingToTab: tab }));
  }, []);
  
  const setHasInitialFetchCompleted = useCallback((completed: boolean) => {
    setUIState(prev => ({ ...prev, hasInitialFetchCompleted: completed }));
  }, []);

  const setRefreshSource = useCallback((source: 'pull' | 'tab' | null) => {
    setUIState(prev => ({ ...prev, refreshSource: source }));
  }, []);
  
  // Effects
  useHomeEffects({
    loadingMore: homeData.loadingMore,
    setTabRefreshing,
    setHasInitialFetchCompleted,
    setRefreshSource,
  });
  
  // UI hooks
  const viewingPostHook = useViewingPost();
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const interactionModalHook = useInteractionModal();
  const { showRegistrationSuccess, setShowRegistrationSuccess } = useRegistrationSuccess();
  const fileUpload = useFileUpload();
  const headerScroll = useHeaderScroll({ loadingMore: homeData.loadingMore });
  
  // Infinite scroll — ใช้ FEED_PRELOAD_* (โหลดล่วงหน้า 800px ก่อนถึงล่าง)
  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: homeData.loadingMore,
    hasMore: homeData.hasMore,
    onLoadMore: () => homeData.setPage(prevPage => prevPage + 1),
  });
  
  // Handlers
  const handlers = useHomeHandlers({
    homeData,
    fileUpload,
    router,
    setIsSearchScreenOpen: sharedSetIsSearchScreenOpen ?? search.setIsSearchScreenOpen,
    setTabRefreshing,
    setSearchTerm: sharedSetSearchTerm,
    setRefreshSource,
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
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
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
    headerScroll,
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
    // Search (จาก shared context หรือ local)
    searchTerm: sharedSearchTerm !== undefined ? sharedSearchTerm : search.searchTerm,
    setSearchTerm: sharedSetSearchTerm ?? search.setSearchTerm,
    isSearchScreenOpen: search.isSearchScreenOpen,
    setIsSearchScreenOpen: sharedSetIsSearchScreenOpen ?? search.setIsSearchScreenOpen,
    
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
    refreshSource: uiState.refreshSource,
    navigatingToTab: uiState.navigatingToTab,
    handleTabSwitchStart,
    fileUpload,
    isInteractionModalOpen: interactionModalHook.interactionModal.show,
    headerScroll,
  };
}
