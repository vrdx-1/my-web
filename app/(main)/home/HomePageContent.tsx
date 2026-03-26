'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';
import { useHomeTabData, type HomeTab } from '@/hooks/useHomeTabData';
import { useHomeRefresh } from '@/hooks/useHomeRefresh';
import { useHomeTabSwitch } from '@/hooks/useHomeTabSwitch';
import { usePostListData } from '@/hooks/usePostListData';
import { useHomeScrollCoordinator } from '@/hooks/useHomeScrollCoordinator';
import { useHomeRefreshState } from '@/hooks/useHomeRefreshState';
import { useHomeSearchState } from '@/hooks/useHomeSearchState';

import { FeedSkeleton } from '@/components/FeedSkeleton';
import { HomeFeedBody } from './HomeFeedBody';
import { SoldTabFeedWrapper } from './SoldTabFeedWrapper';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export type { HomeTab };

export function HomePageContent() {
  const [clientMounted, setClientMounted] = useState(false);
  useEffect(() => {
    setClientMounted(true);
  }, []);

  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleSubmitReportRef = useRef<(() => void) | null>(null);
  const { session, sessionReady, startSessionCheck } = useSessionAndProfile();
  const { firstFeedLoaded, setFirstFeedLoaded } = useFirstFeedLoaded();

  const tabData = useHomeTabData({
    session,
    sessionReady,
    startSessionCheck,
    setFirstFeedLoaded,
  });

  const {
    sharedLikedSaved,
    recommendFeed,
    searchData,
    hasSearch,
    isSoldTabNoSearch,
    postList,
    searchQuery,
    tab,
    mainTab,
    homeProvince,
    pathname,
    router,
    searchParams,
  } = tabData;

  /** แสดงแถว skeleton โหลดเพิ่มทันทีที่ sentinel/prefetch ยิง setPage — ก่อน loadingMore จาก API (ช่วงรอ useEffect เรียก fetchPosts) */
  const [recommendLoadMoreShell, setRecommendLoadMoreShell] = useState(false);

  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    status: 'sold',
    sharedLikedSaved,
    province: selectedProvince,
  });

  const effectiveLoadingMore = isSoldTabNoSearch ? soldListData.loadingMore : postList.loadingMore;
  const { soldTabRefreshRef } = useHomeRefreshState({
    tab,
    selectedProvince,
    soldListData,
    effectiveLoadingMore,
    mainTab: mainTab ?? null,
    setTabRefreshing,
  });

  const posts = isSoldTabNoSearch ? soldListData.posts : tabData.posts;

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
    hasSoldTabCache: soldListData.posts.length > 0,
    hasRecommendTabCache: recommendFeed.posts.length > 0,
    hasSearchResultsCache: hasSearch && searchData.posts.length > 0,
  });

  const headerVisibility = useHeaderVisibilityContext();

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const handleRecommendLoadMore = useCallback(() => {
    setRecommendLoadMoreShell(true);
    postList.setPage((p: number) => p + 1);
  }, [postList.setPage]);

  useEffect(() => {
    if (postList.loadingMore) setRecommendLoadMoreShell(false);
  }, [postList.loadingMore]);

  useEffect(() => {
    if (!recommendLoadMoreShell) return;
    const t = window.setTimeout(() => setRecommendLoadMoreShell(false), 8000);
    return () => clearTimeout(t);
  }, [recommendLoadMoreShell]);

  useEffect(() => {
    if (isSoldTabNoSearch) setRecommendLoadMoreShell(false);
  }, [isSoldTabNoSearch]);

  useEffect(() => {
    setRecommendLoadMoreShell(false);
  }, [selectedProvince]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postList.loadingMore,
    hasMore: postList.hasMore,
    onLoadMore: handleRecommendLoadMore,
    /** ผลค้นหาโฮมโหลดเพิ่มแบบ client slice — ไม่มี loadingMore สลับ ต้องรีเซ็ต sentinel เมื่อจำนวนโพสเปลี่ยน */
    feedPostCount: postList.posts.length,
  });

  const { toggleSave } = usePostInteractions({
    session: postList.session,
    posts: postList.posts,
    setPosts: postList.setPosts,
    savedPosts: postList.savedPosts,
    setSavedPosts: postList.setSavedPosts,
    setJustSavedPosts,
  });

  const showFeedSkeleton =
    !isSoldTabNoSearch &&
    (searchWaitingResults ||
      (posts.length === 0 &&
        (postList.loadingMore || (!firstFeedLoaded && !(tab === 'sold' && hasSearch)))) ||
      (tabRefreshing && postList.loadingMore));

  const {
    feedRestoreWrapRef,
    recommendPanelRef,
    soldPanelRef,
    suppressHideUntilRef,
  } = useHomeScrollCoordinator({
    pathname,
    clientMounted,
    firstFeedLoaded,
    showFeedSkeleton,
    isSoldTabNoSearch,
  });

  const headerScroll = useHeaderScroll({
    loadingMore: effectiveLoadingMore,
    feedPostCount: isSoldTabNoSearch ? soldListData.posts.length : postList.posts.length,
    onVisibilityChange: (visible) => headerVisibility?.setHeaderVisible(visible),
    suppressHideUntilRef,
    scrollTuning: {
      showThresholdPx: 120,
      hideThresholdPx: 360,
      minScrollDeltaPx: 20,
      fastScrollDeltaPx: 30,
      fastMinScrollDeltaPx: 24,
      visibilityThrottleMs: 240,
      layoutSettleIgnoreMs: 420,
      captionToggleIgnoreMs: 650,
    },
  });

  const effectiveSession = isSoldTabNoSearch ? session : postList.session;
  const handlers = usePostFeedHandlers({
    session: effectiveSession,
    posts: postList.posts,
    setPosts: postList.setPosts,
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
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
  });

  const { addBackStep } = useBackHandler();
  useEffect(() => {
    if (!fullScreenViewer.fullScreenImages) return;
    const close = () => {
      fullScreenViewer.setFullScreenImages(null);
      if (fullScreenViewer.activePhotoMenu !== null) {
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
    const close = () => viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible);
    return addBackStep(close);
  }, [viewingPostHook.viewingPost]);

  /** โหลดโพสถัดไปล่วงหน้าเมื่อโพสสุดท้ายโหลดรูปครบ — จำกัดเมื่อมีโพสในคิวไม่เกิน 2 เพื่อไม่ดึงยิงทั้งฟีด */
  const onPrefetchNextPost = useCallback(() => {
    if (isSoldTabNoSearch || tab !== 'recommend') return;
    if (postList.posts.length > 2) return;
    if (!postList.hasMore || postList.loadingMore) return;
    setRecommendLoadMoreShell(true);
    postList.setPage((p: number) => p + 1);
  }, [
    isSoldTabNoSearch,
    tab,
    postList.posts.length,
    postList.hasMore,
    postList.loadingMore,
    postList.setPage,
  ]);

  const recommendPostFeedProps = useMemo(
    () => ({
      posts,
      session: postList.session,
      savedPosts: postList.savedPosts,
      justSavedPosts,
      activeMenuState: menu.activeMenuState,
      isMenuAnimating: menu.isMenuAnimating,
      lastPostElementRef,
      menuButtonRefs: menu.menuButtonRefs,
      onViewPost: handlers.handleViewPost,
      onSave: toggleSave,
      onShare: handlers.handleShare,
      onTogglePostStatus: handlers.handleTogglePostStatus,
      onDeletePost: handlers.handleDeletePost,
      onReport: handlers.handleReport,
      onSetActiveMenu: menu.setActiveMenu,
      onSetMenuAnimating: menu.setIsMenuAnimating,
      /** ห้าม mask ด้วย hasMore: ใน useHomeFeed หลัง API จะ setHasMore ก่อน แล้วค่อย await supabase โหลดโพสเต็ม — ช่วงนั้น hasMore อาจเป็น false แต่ loadingMore ยัง true → ถ้าส่ง false จะไม่มี skeleton + totalSize สั้นลง = พื้นขาวด้านล่าง */
      loadingMore: postList.loadingMore || recommendLoadMoreShell,
      hasMore: postList.hasMore ?? true,
      onLoadMore: handleRecommendLoadMore,
      hideBoost: false,
    }),
    [
      posts,
      postList.session,
      postList.savedPosts,
      postList.hasMore,
      postList.loadingMore,
      recommendLoadMoreShell,
      handleRecommendLoadMore,
      justSavedPosts,
      menu.activeMenuState,
      menu.isMenuAnimating,
      menu.menuButtonRefs,
      menu.setActiveMenu,
      menu.setIsMenuAnimating,
      lastPostElementRef,
      handlers.handleViewPost,
      handlers.handleShare,
      handlers.handleTogglePostStatus,
      handlers.handleDeletePost,
      handlers.handleReport,
      toggleSave,
    ],
  );

  /** เฟรมแรกหลัง hydrate: อย่า return null — จะเห็นพื้นขาวก่อนโฮมโผล่ */
  if (!clientMounted) {
    return (
      <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
        <div>
          <div ref={recommendPanelRef} style={{ display: 'block' }} aria-hidden={false}>
            <FeedSkeleton count={3} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div ref={feedRestoreWrapRef}>
        {/* แท็บพร้อมขาย (หรือค้นหา): เก็บไว้ไม่ปิด แค่ซ่อน/แสดง + จดจำ scroll */}
        <div ref={recommendPanelRef} style={{ display: isSoldTabNoSearch ? 'none' : 'block' }} aria-hidden={isSoldTabNoSearch}>
          <HomeFeedBody
            showSkeleton={showFeedSkeleton}
            forceSkeletonWhenEmpty={searchWaitingResults}
            mayShowEmptyState={!searchWaitingResults}
            isSearchLoading={hasSearch && searchData.loading}
            skeletonCount={3}
            gateImageReady={tab === 'recommend' && !isSoldTabNoSearch}
            onPrefetchNextPost={onPrefetchNextPost}
            postFeedProps={recommendPostFeedProps}
          />
        </div>
        {/* แท็บขายแล้ว: เก็บไว้ไม่ปิด แค่ซ่อน/แสดง + จดจำ scroll (ref สำหรับคืน scroll แบบเดียวกับพร้อมขาย) */}
        <div ref={soldPanelRef} style={{ display: isSoldTabNoSearch ? 'block' : 'none' }} aria-hidden={!isSoldTabNoSearch}>
          <SoldTabFeedWrapper
            soldListData={soldListData}
            menu={menu}
            viewingPostHook={viewingPostHook}
            headerScroll={headerScroll}
            fullScreenViewer={fullScreenViewer}
            reportingPost={reportingPost}
            setReportingPost={setReportingPost}
            reportReason={reportReason}
            setReportReason={setReportReason}
            isSubmittingReport={isSubmittingReport}
            setIsSubmittingReport={setIsSubmittingReport}
            justSavedPosts={justSavedPosts}
            setJustSavedPosts={setJustSavedPosts}
            handleSubmitReportRef={handleSubmitReportRef}
          />
        </div>
      </div>

      {(viewingPostHook.viewingPost ||
        fullScreenViewer.fullScreenImages ||
        reportingPost) && (
        <PostFeedModals
          viewingPost={viewingPostHook.viewingPost}
          session={effectiveSession}
          isViewingModeOpen={viewingPostHook.isViewingModeOpen}
          viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
          savedScrollPosition={viewingPostHook.savedScrollPosition}
          initialImageIndex={viewingPostHook.initialImageIndex}
          onViewingPostClose={() =>
            viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible)
          }
          onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
          onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
          onViewingPostTouchEnd={(e: React.TouchEvent) =>
            viewingPostHook.handleViewingModeTouchEnd(e, () => {})
          }
          onViewingPostImageClick={(images: string[], index: number) => {
            fullScreenViewer.setFullScreenImages(images);
            fullScreenViewer.setCurrentImgIndex(index);
          }}
          fullScreenImages={fullScreenViewer.fullScreenImages}
          currentImgIndex={fullScreenViewer.currentImgIndex}
          fullScreenDragOffset={fullScreenViewer.fullScreenDragOffset}
          fullScreenEntranceOffset={fullScreenViewer.fullScreenEntranceOffset}
          fullScreenVerticalDragOffset={fullScreenViewer.fullScreenVerticalDragOffset}
          fullScreenIsDragging={fullScreenViewer.fullScreenIsDragging}
          fullScreenTransitionDuration={fullScreenViewer.fullScreenTransitionDuration}
          fullScreenShowDetails={fullScreenViewer.fullScreenShowDetails}
          fullScreenZoomScale={fullScreenViewer.fullScreenZoomScale}
          fullScreenZoomOrigin={fullScreenViewer.fullScreenZoomOrigin}
          activePhotoMenu={fullScreenViewer.activePhotoMenu}
          isPhotoMenuAnimating={fullScreenViewer.isPhotoMenuAnimating}
          showDownloadBottomSheet={fullScreenViewer.showDownloadBottomSheet}
          isDownloadBottomSheetAnimating={fullScreenViewer.isDownloadBottomSheetAnimating}
          showImageForDownload={fullScreenViewer.showImageForDownload}
          onFullScreenClose={() => {
            fullScreenViewer.setFullScreenImages(null);
            if (fullScreenViewer.activePhotoMenu !== null) {
              setTimeout(() => fullScreenViewer.setActivePhotoMenu(null), 300);
            }
          }}
          onFullScreenTouchStart={fullScreenViewer.fullScreenOnTouchStart}
          onFullScreenTouchMove={fullScreenViewer.fullScreenOnTouchMove}
          onFullScreenTouchEnd={fullScreenViewer.fullScreenOnTouchEnd}
          onFullScreenClick={fullScreenViewer.fullScreenOnClick}
          onFullScreenDownload={fullScreenViewer.downloadImage}
          onFullScreenImageIndexChange={fullScreenViewer.setCurrentImgIndex}
          onFullScreenPhotoMenuToggle={fullScreenViewer.setActivePhotoMenu}
          onFullScreenDownloadBottomSheetClose={() => {
            fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
            setTimeout(() => {
              fullScreenViewer.setShowDownloadBottomSheet(false);
              fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
            }, 300);
          }}
          onFullScreenDownloadBottomSheetDownload={() => {
            if (fullScreenViewer.showImageForDownload) {
              fullScreenViewer.downloadImage(fullScreenViewer.showImageForDownload);
            }
          }}
          onFullScreenImageForDownloadClose={() =>
            fullScreenViewer.setShowImageForDownload(null)
          }
          reportingPost={reportingPost}
          reportReason={reportReason}
          isSubmittingReport={isSubmittingReport}
          onReportClose={() => setReportingPost(null)}
          onReportReasonChange={setReportReason}
          onReportSubmit={
            isSoldTabNoSearch
              ? () => handleSubmitReportRef.current?.()
              : handlers.handleSubmitReport
          }
        />
      )}

      {!isSoldTabNoSearch && handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}
      {!isSoldTabNoSearch && handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
        />
      )}
      {!isSoldTabNoSearch && handlers.showDeleteSuccess && (
        <SuccessPopup
          message="ລົບໂພສສຳເລັດ"
          onClose={() => handlers.setShowDeleteSuccess?.(false)}
        />
      )}
    </main>
  );
}
