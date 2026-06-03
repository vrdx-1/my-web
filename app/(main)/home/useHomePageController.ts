'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';
import { useHomeTabData } from '@/hooks/useHomeTabData';
import { useHomeRefresh } from '@/hooks/useHomeRefresh';
import { useHomeTabSwitch } from '@/hooks/useHomeTabSwitch';
import { usePostListData } from '@/hooks/usePostListData';
import { useHomeScrollCoordinator } from '@/hooks/useHomeScrollCoordinator';
import { useHomeRefreshState } from '@/hooks/useHomeRefreshState';
import { useHomeSearchState } from '@/hooks/useHomeSearchState';
import { useRecommendLoadMoreShell } from '@/hooks/useRecommendLoadMoreShell';
import { useReportModalState } from '@/hooks/useReportModalState';
import { useHomeEffectivePostList } from '@/hooks/useHomeEffectivePostList';
import { useSavedPostsTracking } from '@/hooks/useSavedPostsTracking';
import { useRecommendPostFeedProps } from '@/hooks/useRecommendPostFeedProps';
import { usePostModalsBackHandler } from '@/hooks/usePostModalsBackHandler';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';
import type { SoldTabFeedWrapperProps } from './SoldTabFeedWrapper';

export interface UseHomePageControllerOptions {
  clientMounted: boolean;
}

export function useHomePageController(options: UseHomePageControllerOptions) {
  const { clientMounted } = options;
  const [tabRefreshing, setTabRefreshing] = useState(false);

  const { justSavedPosts, setJustSavedPosts } = useSavedPostsTracking();
  const {
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
  } = useReportModalState();

  const handleSubmitReportRef = useRef<(() => void) | null>(null);
  const { session, sessionReady, activeProfileId, authUserId, startSessionCheck } = useSessionAndProfile();
  const { firstFeedLoaded, setFirstFeedLoaded } = useFirstFeedLoaded();

  const tabData = useHomeTabData({
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    startSessionCheck,
    setFirstFeedLoaded,
  });

  const {
    sharedLikedSaved,
    recommendFeed,
    searchData,
    hasSearch,
    postList,
    searchQuery,
    tab,
    mainTab,
    homeProvince,
    pathname,
    router,
    searchParams,
  } = tabData;

  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const minPriceKip = homeProvince?.minPriceKip ?? null;
  const maxPriceKip = homeProvince?.maxPriceKip ?? null;
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    activeProfileId,
    status: 'sold',
    sharedLikedSaved,
    province: selectedProvince,
    minPriceKip,
    maxPriceKip,
  });

  const { isSoldTabNoSearch, effectivePostList } = useHomeEffectivePostList({
    tab,
    tabPostList: postList,
    soldListData,
    hasSearch,
  });
  const isSoldTabActive = tab === 'sold';

  const { shell: recommendLoadMoreShell, triggerLoadMore: triggerRecommendLoadMore } =
    useRecommendLoadMoreShell({
      postListLoadingMore: effectivePostList.loadingMore,
      isSoldTabNoSearch,
      selectedProvince,
      minPriceKip,
      maxPriceKip,
    });

  const effectiveLoadingMore = effectivePostList.loadingMore;
  const { soldTabRefreshRef } = useHomeRefreshState({
    tab,
    selectedProvince,
    minPriceKip,
    maxPriceKip,
    soldListData,
    effectiveLoadingMore,
    mainTab: mainTab ?? null,
    setTabRefreshing,
  });

  const posts = effectivePostList.posts;
  const recommendPanelList = isSoldTabNoSearch ? recommendFeed : effectivePostList;

  const { searchWaitingResults } = useHomeSearchState({
    hasSearch,
    searchQuery,
    searchLoading: searchData.loading,
    postsLength: posts.length,
  });

  useHomeRefresh({
    tab,
    mainTab: mainTab ?? null,
    pathname,
    router,
    searchParams,
    homeProvince: homeProvince ?? null,
    recommendFeed,
    searchData,
    searchQuery,
    soldTabRefreshRef,
    setTabRefreshing,
  });

  useHomeTabSwitch({
    tab,
    mainTab: mainTab ?? null,
    searchQuery,
    recommendFeed,
    searchData,
    soldTabRefreshRef,
    setTabRefreshing,
  });

  const setHeaderVisible = useSetHeaderVisibility();
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();

  const handleRecommendLoadMore = useCallback(() => {
    if (effectivePostList.loadingMore || !effectivePostList.hasMore) return;
    triggerRecommendLoadMore();
    effectivePostList.setPage((page: number) => page + 1);
  }, [triggerRecommendLoadMore, effectivePostList]);

  const handleLocalPostUpdate = useCallback((postId: string, updateData: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effectivePostList.setPosts((prev: any[]) =>
      prev.map((post) => {
        if (post.id === postId) {
          return { ...post, ...updateData };
        }
        return post;
      })
    );
  }, [effectivePostList]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    enabled: !isSoldTabNoSearch,
    loadingMore: effectivePostList.loadingMore,
    hasMore: effectivePostList.hasMore,
    onLoadMore: handleRecommendLoadMore,
    feedPostCount: posts.length,
  });

  const { toggleSave } = usePostInteractions({
    session: effectivePostList.session,
    activeProfileId,
    posts,
    setPosts: effectivePostList.setPosts,
    savedPosts: effectivePostList.savedPosts,
    setSavedPosts: effectivePostList.setSavedPosts,
    setJustSavedPosts,
  });

  const showFeedSkeleton =
    !isSoldTabNoSearch &&
    (searchWaitingResults ||
      (tabRefreshing && posts.length === 0) ||
      (posts.length === 0 &&
        (effectivePostList.loadingMore || (!hasSearch && !firstFeedLoaded))) ||
      (tabRefreshing && effectivePostList.loadingMore));

  const {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    suppressHideUntilRef,
    isChromeStartupLocked,
  } = useHomeScrollCoordinator({
    pathname,
    clientMounted,
    firstFeedLoaded,
    showFeedSkeleton,
    isSoldTabActive,
    tabRefreshing,
    hasSearch,
  });

  const headerScroll = useHeaderScroll({
    disableScrollHide: false,
    sensitivity: isSoldTabActive ? 1.8 : 1,
    minScrollDeltaPx: isSoldTabActive ? 1 : undefined,
    hideAccumulatedDeltaPx: isSoldTabActive ? 2 : undefined,
    showAccumulatedDeltaPx: isSoldTabActive ? 2 : undefined,
    visibilityCooldownMs: isSoldTabActive ? 80 : undefined,
    onVisibilityChange: (visible) => setHeaderVisible?.(visible),
    suppressHideUntilRef,
  });
  const setHeaderVisibleFromScroll = headerScroll.setIsHeaderVisible;

  const effectiveSession = isSoldTabNoSearch ? session : effectivePostList.session;
  const handlers = usePostFeedHandlers({
    session: effectiveSession,
    posts,
    setPosts: effectivePostList.setPosts,
    viewingPostHook,
    setHeaderVisible: setHeaderVisibleFromScroll,
    menu,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
  });

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
    setIsHeaderVisible: setHeaderVisibleFromScroll,
  });

  const { addBackStep } = useBackHandler();
  usePostModalsBackHandler({
    addBackStep,
    fullScreenImages: fullScreenViewer.fullScreenImages,
    activePhotoMenu: fullScreenViewer.activePhotoMenu,
    setFullScreenImages: fullScreenViewer.setFullScreenImages,
    setIsPhotoMenuAnimating: fullScreenViewer.setIsPhotoMenuAnimating,
    setActivePhotoMenu: fullScreenViewer.setActivePhotoMenu,
    viewingPost: viewingPostHook.viewingPost,
    onCloseViewingPost: () =>
      viewingPostHook.closeViewingMode(setHeaderVisibleFromScroll),
  });

  const onPrefetchNextPost = useCallback(() => {
    if (isSoldTabNoSearch || tab !== 'recommend') return;
    if (posts.length > 2) return;
    if (!effectivePostList.hasMore || effectivePostList.loadingMore) return;
    triggerRecommendLoadMore();
    effectivePostList.setPage((page: number) => page + 1);
  }, [
    isSoldTabNoSearch,
    tab,
    posts.length,
    effectivePostList,
    triggerRecommendLoadMore,
  ]);

  const recommendPostFeedProps = useRecommendPostFeedProps({
    posts: recommendPanelList.posts,
    session: recommendPanelList.session,
    savedPosts: recommendPanelList.savedPosts,
    justSavedPosts,
    activeMenuState: menu.activeMenuState,
    isMenuAnimating: menu.isMenuAnimating,
    lastPostElementRef: isSoldTabNoSearch ? undefined : lastPostElementRef,
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
    loadingMore: isSoldTabNoSearch ? false : effectivePostList.loadingMore || recommendLoadMoreShell,
    hasMore: isSoldTabNoSearch ? false : effectivePostList.hasMore ?? true,
    onLoadMore: handleRecommendLoadMore,
  });

  const soldTabProps: Omit<SoldTabFeedWrapperProps, 'isActive'> = useMemo(
    () => ({
      soldListData,
      menu,
      viewingPostHook,
      setHeaderVisible: setHeaderVisibleFromScroll,
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
      isRefreshing: tabRefreshing,
    }),
    [
      soldListData,
      menu,
      viewingPostHook,
      setHeaderVisibleFromScroll,
      fullScreenViewer,
      reportingPost,
      setReportingPost,
      reportReason,
      setReportReason,
      isSubmittingReport,
      setIsSubmittingReport,
      justSavedPosts,
      setJustSavedPosts,
      tabRefreshing,
    ],
  );

  return {
    effectiveSession,
    feedRestoreWrapRef,
    fullScreenViewer,
    handleLocalPostUpdate,
    handlers,
    hasSearch,
    setHeaderVisibleFromScroll,
    isSoldTabActive,
    isSoldTabNoSearch,
    isSubmittingReport,
    onPrefetchNextPost,
    recommendPanelRef,
    recommendPostFeedProps,
    reportReason,
    reportingPost,
    searchDataLoading: searchData.loading,
    searchWaitingResults,
    selectedProvince,
    activeProfileId,
    authUserId,
    setReportReason,
    setReportingPost,
    showFeedSkeleton,
    soldPanelRef,
    soldTabProps,
    tab,
    viewingPostHook,
  };
}