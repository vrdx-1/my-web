'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { InteractionModal } from '@/components/modals/InteractionModal';

import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';
import { useHomeTabData, type HomeTab } from '@/hooks/useHomeTabData';
import { useHomeRefresh } from '@/hooks/useHomeRefresh';
import { useHomeTabSwitch } from '@/hooks/useHomeTabSwitch';
import { usePostListData } from '@/hooks/usePostListData';
import { useHomeTabScroll } from '@/contexts/HomeTabScrollContext';

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
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const postsRef = useRef<any[]>([]);
  const prevLoadingMoreRef = useRef(false);
  const soldTabRefreshRef = useRef<{
    setPage: (v: number | ((p: number) => number)) => void;
    setHasMore: (v: boolean) => void;
    fetchPosts: (isInitial?: boolean) => Promise<void>;
  } | null>(null);
  const handleSubmitReportRef = useRef<(() => void) | null>(null);
  /** ใช้แยก "กำลังรอผลค้นหา" (แสดง skeleton) กับ "ค้นหาเสร็จแล้วไม่มีรายการ" (แสดง ຍັງບໍ່ມີລາຍການ) */
  const searchResolvedRef = useRef(false);
  const prevSearchQueryRef = useRef<string>('');
  const prevSearchLoadingRef = useRef(false);
  /** แสดง "ຍັງບໍ່ມີລາຍການ" ได้เฉพาะเมื่อ true = โหลดค้นหาเสร็จแล้ว (loading เปลี่ยนจาก true → false) */
  const [searchResolvedForEmpty, setSearchResolvedForEmpty] = useState(false);
  const prevQueryForEmptyRef = useRef<string>('');
  /** จำ scroll ของแท็บพร้อมขาย/ขายแล้ว — สลับแท็บแล้วกลับมาเห็นจุดเดิม (แบบ MainTabPanels) */
  const recommendScrollRef = useRef(0);
  const soldScrollRef = useRef(0);
  const prevShowSoldRef = useRef<boolean | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const suppressHideUntilRef = useRef<number | null>(null);

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

  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    status: 'sold',
    sharedLikedSaved,
    province: selectedProvince,
  });

  useEffect(() => {
    soldTabRefreshRef.current = {
      setPage: soldListData.setPage,
      setHasMore: soldListData.setHasMore,
      fetchPosts: soldListData.fetchPosts,
    };
    return () => {
      soldTabRefreshRef.current = null;
    };
  }, [soldListData.setPage, soldListData.setHasMore, soldListData.fetchPosts]);

  useEffect(() => {
    if (tab === 'sold' && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, soldListData.posts.length, soldListData.loadingMore]);

  useEffect(() => {
    if (tab !== 'sold') return;
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
  }, [selectedProvince]);

  const posts = isSoldTabNoSearch ? soldListData.posts : tabData.posts;
  postsRef.current = posts;

  if (!hasSearch) {
    searchResolvedRef.current = false;
    prevSearchQueryRef.current = '';
    prevSearchLoadingRef.current = false;
  } else {
    if (searchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = searchQuery;
      searchResolvedRef.current = false;
      prevSearchLoadingRef.current = false;
    }
  }

  useEffect(() => {
    if (!hasSearch) {
      setSearchResolvedForEmpty(false);
      return;
    }
    if (prevSearchQueryRef.current !== searchQuery) return;
    const wasLoading = prevSearchLoadingRef.current;
    prevSearchLoadingRef.current = searchData.loading;
    if (wasLoading && !searchData.loading) {
      searchResolvedRef.current = true;
      setSearchResolvedForEmpty(true);
    }
  }, [hasSearch, searchQuery, searchData.loading]);

  useEffect(() => {
    if (!hasSearch) {
      setSearchResolvedForEmpty(false);
      prevQueryForEmptyRef.current = '';
      return;
    }
    if (prevQueryForEmptyRef.current !== searchQuery) {
      setSearchResolvedForEmpty(false);
      prevQueryForEmptyRef.current = searchQuery;
    }
  }, [hasSearch, searchQuery]);

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

  /** บันทึก scroll ก่อนสลับแท็บ — ใช้แบบเดียวกับ saveCurrentScroll ก่อน router.push (ลงทะเบียนให้ header เรียกตอนกดแท็บ) */
  const homeTabScroll = useHomeTabScroll();
  const headerVisibility = useHeaderVisibilityContext();

  /** สลับจากหน้าอื่นกลับมาหน้าโฮม → แสดง header/nav ทันที และกันไม่ให้ scroll ที่เกิดจากการ restore ซ่อน header (ให้หายเฉพาะตอนผู้ใช้เลื่อนจริง) */
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname === '/home' && prev !== '/home' && prev != null) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 500;
      headerVisibility?.setHeaderVisible(true);
    }
  }, [pathname, headerVisibility]);

  useEffect(() => {
    if (!homeTabScroll?.saveBeforeSwitchRef) return;
    homeTabScroll.saveBeforeSwitchRef.current = () => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      if (isSoldTabNoSearch) soldScrollRef.current = y;
      else recommendScrollRef.current = y;
    };
    return () => {
      homeTabScroll.saveBeforeSwitchRef.current = null;
    };
  }, [homeTabScroll, isSoldTabNoSearch]);

  /** สลับแท็บแล้ว: คืนค่า scroll — ฝั่งพร้อมขายเลื่อนลึกแล้วต้อง retry จน layout สูงพอ (เบราว์เซอร์ clamp ถ้า scrollHeight ยังไม่พอ) */
  const recommendPanelRef = useRef<HTMLDivElement | null>(null);
  const setHeaderVisibleRef = useRef(headerVisibility?.setHeaderVisible);
  setHeaderVisibleRef.current = headerVisibility?.setHeaderVisible;
  useLayoutEffect(() => {
    const showSold = isSoldTabNoSearch;
    const prev = prevShowSoldRef.current;
    prevShowSoldRef.current = showSold;
    if (prev === null) return;
    if (prev !== showSold) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 400;
      const toRestore = showSold ? soldScrollRef.current : recommendScrollRef.current;
      const showHeaderAfterRestore = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setHeaderVisibleRef.current?.(true));
        });
      };
      if (typeof window !== 'undefined' && Number.isFinite(toRestore)) {
        if (showSold) {
          window.scrollTo(0, toRestore);
          showHeaderAfterRestore();
        } else {
          const targetY = toRestore;
          let attempts = 0;
          const maxAttempts = 25;
          const tryScroll = () => {
            const el = recommendPanelRef.current;
            if (el) void el.offsetHeight;
            window.scrollTo(0, targetY);
            attempts += 1;
            const current = window.scrollY;
            const diff = Math.abs(current - targetY);
            if (diff > 2 && attempts < maxAttempts) {
              requestAnimationFrame(tryScroll);
            } else {
              showHeaderAfterRestore();
            }
          };
          requestAnimationFrame(() => requestAnimationFrame(tryScroll));
        }
      } else {
        showHeaderAfterRestore();
      }
    }
  }, [isSoldTabNoSearch, headerVisibility]);

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const interactionModalHook = useInteractionModal();
  const isBottomSheetOpen = interactionModalHook.interactionModal.show;
  const headerScroll = useHeaderScroll({
    disableScrollHide: isBottomSheetOpen,
    onVisibilityChange: (visible) => headerVisibility?.setHeaderVisible(visible),
    suppressHideUntilRef,
  });

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postList.loadingMore,
    hasMore: postList.hasMore,
    onLoadMore: () => postList.setPage((p: number) => p + 1),
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

  const effectiveLoadingMore = isSoldTabNoSearch ? soldListData.loadingMore : postList.loadingMore;

  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = effectiveLoadingMore;
    if (wasLoading && !effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setTabRefreshing(false);
    } else if (!effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
    }
  }, [effectiveLoadingMore, mainTab]);

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

  const searchWaitingResults =
    hasSearch && posts.length === 0 && !searchResolvedForEmpty;
  const showFeedSkeleton =
    !isSoldTabNoSearch &&
    (searchWaitingResults ||
      (posts.length === 0 &&
        (postList.loadingMore || (!firstFeedLoaded && !(tab === 'sold' && hasSearch)))) ||
      (tabRefreshing && postList.loadingMore));

  if (!clientMounted) {
    if (hasSearch && !isSoldTabNoSearch) {
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
    return null;
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div>
        {/* แท็บพร้อมขาย (หรือค้นหา): เก็บไว้ไม่ปิด แค่ซ่อน/แสดง + จดจำ scroll */}
        <div ref={recommendPanelRef} style={{ display: isSoldTabNoSearch ? 'none' : 'block' }} aria-hidden={isSoldTabNoSearch}>
          <HomeFeedBody
            showSkeleton={showFeedSkeleton}
            forceSkeletonWhenEmpty={searchWaitingResults}
            mayShowEmptyState={!searchWaitingResults}
            isSearchLoading={hasSearch && searchData.loading}
            skeletonCount={3}
            postFeedProps={{
              posts,
              session: postList.session,
              likedPosts: postList.likedPosts,
              savedPosts: postList.savedPosts,
              justLikedPosts,
              justSavedPosts,
              activeMenuState: menu.activeMenuState,
              isMenuAnimating: menu.isMenuAnimating,
              lastPostElementRef,
              menuButtonRefs: menu.menuButtonRefs,
              onViewPost: handlers.handleViewPost,
              onImpression: handlers.handleImpression,
              onLike: toggleLike,
              onSave: toggleSave,
              onShare: handlers.handleShare,
              onViewLikes: (postId) => fetchInteractions('likes', postId),
              onViewSaves: (postId) => fetchInteractions('saves', postId),
              onTogglePostStatus: handlers.handleTogglePostStatus,
              onDeletePost: handlers.handleDeletePost,
              onReport: handlers.handleReport,
              onSetActiveMenu: menu.setActiveMenu,
              onSetMenuAnimating: menu.setIsMenuAnimating,
              loadingMore: postList.hasMore ? postList.loadingMore : false,
              hasMore: postList.hasMore ?? true,
              onLoadMore: () => postList.setPage((p: number) => p + 1),
              hideBoost: false,
            }}
          />
        </div>
        {/* แท็บขายแล้ว: เก็บไว้ไม่ปิด แค่ซ่อน/แสดง + จดจำ scroll */}
        <div style={{ display: isSoldTabNoSearch ? 'block' : 'none' }} aria-hidden={!isSoldTabNoSearch}>
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
            justLikedPosts={justLikedPosts}
            setJustLikedPosts={setJustLikedPosts}
            justSavedPosts={justSavedPosts}
            setJustSavedPosts={setJustSavedPosts}
            fetchInteractions={fetchInteractions}
            postsRef={postsRef}
            handleSubmitReportRef={handleSubmitReportRef}
          />
        </div>
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
