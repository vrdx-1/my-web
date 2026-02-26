'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PostFeed } from '@/components/PostFeed';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { InteractionModal } from '@/components/modals/InteractionModal';

import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useSearchPosts } from '@/hooks/useSearchPosts';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export type HomeTab = 'recommend' | 'sold';

export function HomePageContent() {
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [sessionState, setSessionState] = useState<any>(undefined);
  const postsRef = useRef<any[]>([]);
  const prevLoadingMoreRef = useRef(false);
  const [onlineStatusTick, setOnlineStatusTick] = useState(0);

  const mainTab = useMainTabContext();
  const tab = mainTab?.homeTab ?? 'recommend';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') ?? '';

  const recommendFeed = useHomeFeed({ session: sessionState, province: selectedProvince });
  const searchData = useSearchPosts({
    query: searchQuery,
    province: selectedProvince,
    session: sessionState,
  });
  const soldListData = usePostListData({
    type: 'sold',
    session: sessionState,
    status: 'sold',
  });

  const recommendSource =
    searchQuery.trim().length > 0
      ? {
          posts: searchData.posts,
          setPosts: searchData.setPosts,
          session: searchData.session,
          likedPosts: searchData.likedPosts,
          savedPosts: searchData.savedPosts,
          setLikedPosts: searchData.setLikedPosts,
          setSavedPosts: searchData.setSavedPosts,
          loadingMore: searchData.loading,
          hasMore: false,
          setPage: () => {},
          fetchPosts: () => searchData.fetchSearch(),
        }
      : recommendFeed;

  const posts = tab === 'recommend' ? recommendSource.posts : soldListData.posts;
  const postList = tab === 'recommend' ? recommendSource : soldListData;
  postsRef.current = posts;

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => setSessionState(session));
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setOnlineStatusTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const headerVisibility = useHeaderVisibilityContext();
  const headerScroll = useHeaderScroll({
    onVisibilityChange: (visible) => headerVisibility?.setHeaderVisible(visible),
  });
  const interactionModalHook = useInteractionModal();

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postList.loadingMore,
    hasMore: postList.hasMore,
    onLoadMore: () => postList.setPage((p) => p + 1),
  });

  const { toggleLike, toggleSave } = usePostInteractions({
    session: postList.session,
    posts: postList.posts,
    setPosts: postList.setPosts,
    likedPosts: postList.likedPosts,
    savedPosts: postList.savedPosts,
    setLikedPosts: postList.setLikedPosts,
    setSavedPosts: postList.setSavedPosts,
    setJustLikedPosts,
    setJustSavedPosts,
  });

  useEffect(() => {
    if (tab !== 'sold' || sessionState === undefined || soldListData.session === undefined) return;
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
  }, [tab, sessionState, soldListData.session]);

  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = postList.loadingMore;
    if (wasLoading && !postList.loadingMore) {
      setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setTabRefreshing(false);
    } else if (!postList.loadingMore) {
      setTabRefreshing(false);
      mainTab?.setTabRefreshing(false);
    }
  }, [postList.loadingMore, mainTab]);

  const doRefresh = useCallback((options?: { fromHomeButton?: boolean }) => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    // ทุกชนิด refresh (browser/กดแท็บ) → ฟิลเตอร์กลับเป็น "ທຸກແຂວງ"
    homeProvince?.setSelectedProvince('');
    // กดแท็บ refresh → ล้างคำค้นหา; กดปุ่ม Home refresh ไม่ล้าง (ให้เหมือนกดแท็บ ພ້ອມຂາຍ/ຂາຍແລ້ວ)
    if (!options?.fromHomeButton && searchParams.has('q')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      const queryString = params.toString();
      const newUrl = pathname + (queryString ? `?${queryString}` : '');
      window.history.replaceState(null, '', newUrl);
      router.replace(newUrl, { scroll: false });
    }
    if (options?.fromHomeButton) {
      mainTab?.setRefreshSource('home');
    } else {
      mainTab?.setRefreshSource('pull');
    }
    setTabRefreshing(true);
    if (tab === 'recommend') {
      if (searchQuery.trim()) {
        searchData.fetchSearch().finally(() => mainTab?.setRefreshSource(null));
      } else {
        recommendFeed.setPage(0);
        recommendFeed.setHasMore(true);
        recommendFeed.fetchPosts(true).finally(() => mainTab?.setRefreshSource(null));
      }
    } else {
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true).finally(() => mainTab?.setRefreshSource(null));
    }
  }, [tab, mainTab, pathname, recommendFeed, soldListData, searchData, searchQuery, searchParams, router, homeProvince]);

  useEffect(() => {
    mainTab?.registerTabRefreshHandler(doRefresh);
    return () => mainTab?.unregisterTabRefreshHandler();
  }, [mainTab, doRefresh]);

  const handlers = usePostFeedHandlers({
    session: postList.session,
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
    interactionModalShow: interactionModalHook.interactionModal.show,
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

  const fetchInteractions = useCallback(
    async (type: 'likes' | 'saves', postId: string) => {
      await interactionModalHook.fetchInteractions(type, postId, postsRef.current);
    },
    [interactionModalHook],
  );

  const setTabAndRefresh = useCallback((newTab: HomeTab) => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    if (newTab === tab) {
      mainTab?.setTabRefreshing(true);
      setTabRefreshing(true);
      if (newTab === 'recommend') {
        if (searchQuery.trim()) {
          searchData.fetchSearch();
        } else {
          recommendFeed.setPage(0);
          recommendFeed.setHasMore(true);
          recommendFeed.fetchPosts(true);
        }
      } else {
        soldListData.setPage(0);
        soldListData.setHasMore(true);
        soldListData.fetchPosts(true);
      }
    } else {
      mainTab?.setNavigatingToTab(newTab);
      mainTab?.setHomeTab(newTab);
      setTabRefreshing(true);
      if (newTab === 'recommend') {
        if (searchQuery.trim()) {
          searchData.fetchSearch();
        } else {
          recommendFeed.setPage(0);
          recommendFeed.setHasMore(true);
          recommendFeed.fetchPosts(true);
        }
      }
      // sold: fetch ถูกเรียกใน useEffect เมื่อ tab === 'sold'
    }
  }, [tab, mainTab, searchQuery, recommendFeed, searchData, soldListData]);

  useEffect(() => {
    mainTab?.registerTabChangeHandler(setTabAndRefresh);
    return () => mainTab?.unregisterTabChangeHandler();
  }, [mainTab, setTabAndRefresh]);

  /** ล็อกไม่ให้ดึง Header และฟีดลงเมื่ออยู่บนสุด (ทุกอุปกรณ์ รวมถึง iPhone) — ป้องกัน overscroll/bounce */
  const homePullLockStartY = useRef(0);
  useEffect(() => {
    if (pathname !== '/home') return;
    const doc = document;
    const SCROLL_TOP_THRESHOLD = 8;
    const handleTouchStart = (e: TouchEvent) => {
      homePullLockStartY.current = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY > SCROLL_TOP_THRESHOLD) return;
      const currentY = e.touches[0].clientY;
      if (currentY > homePullLockStartY.current) e.preventDefault();
    };
    doc.addEventListener('touchstart', handleTouchStart, { passive: true });
    doc.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      doc.removeEventListener('touchstart', handleTouchStart);
      doc.removeEventListener('touchmove', handleTouchMove);
    };
  }, [pathname]);

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div>
        {(posts.length === 0 && (postList.loadingMore || sessionState === undefined)) || (tabRefreshing && postList.loadingMore) ? (
          <FeedSkeleton />
        ) : (
          <PostFeed
          posts={posts}
          session={postList.session}
          likedPosts={postList.likedPosts}
          savedPosts={postList.savedPosts}
          justLikedPosts={justLikedPosts}
          justSavedPosts={justSavedPosts}
          activeMenuState={menu.activeMenuState}
          isMenuAnimating={menu.isMenuAnimating}
          lastPostElementRef={lastPostElementRef}
          menuButtonRefs={menu.menuButtonRefs}
          onViewPost={handlers.handleViewPost}
          onImpression={handlers.handleImpression}
          onLike={toggleLike}
          onSave={toggleSave}
          onShare={handlers.handleShare}
          onViewLikes={(postId) => fetchInteractions('likes', postId)}
          onViewSaves={(postId) => fetchInteractions('saves', postId)}
          onTogglePostStatus={handlers.handleTogglePostStatus}
          onDeletePost={handlers.handleDeletePost}
          onReport={handlers.handleReport}
          onSetActiveMenu={menu.setActiveMenu}
          onSetMenuAnimating={menu.setIsMenuAnimating}
          loadingMore={postList.hasMore ? postList.loadingMore : false}
          hasMore={postList.hasMore}
          onLoadMore={() => postList.setPage((p) => p + 1)}
          hideBoost={tab === 'sold'}
          onlineStatusTick={onlineStatusTick}
        />
        )}
      </div>

      <InteractionModal
        show={interactionModalHook.interactionModal.show}
        type={interactionModalHook.interactionModal.type}
        postId={interactionModalHook.interactionModal.postId}
        posts={posts}
        interactionUsers={interactionModalHook.interactionUsers}
        interactionLoading={interactionModalHook.interactionLoading}
        interactionSheetMode={interactionModalHook.interactionSheetMode}
        isInteractionModalAnimating={interactionModalHook.isInteractionModalAnimating}
        startY={interactionModalHook.startY}
        currentY={interactionModalHook.currentY}
        onClose={interactionModalHook.closeModal}
        onSheetTouchStart={interactionModalHook.onSheetTouchStart}
        onSheetTouchMove={interactionModalHook.onSheetTouchMove}
        onSheetTouchEnd={interactionModalHook.onSheetTouchEnd}
        onFetchInteractions={(type, postId) => fetchInteractions(type, postId)}
      />

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={postList.session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible)}
        onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
        onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
        onViewingPostTouchEnd={(e: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(e, () => {})}
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
        onFullScreenImageForDownloadClose={() => fullScreenViewer.setShowImageForDownload(null)}
        reportingPost={reportingPost}
        reportReason={reportReason}
        isSubmittingReport={isSubmittingReport}
        onReportClose={() => setReportingPost(null)}
        onReportReasonChange={setReportReason}
        onReportSubmit={handlers.handleSubmitReport}
      />

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
    </main>
  );
}
