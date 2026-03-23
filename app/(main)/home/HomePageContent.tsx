'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
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
import { useHomeTabScroll } from '@/contexts/HomeTabScrollContext';
import { useMainTabScroll, readMainTabScrollStorage } from '@/contexts/MainTabScrollContext';

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
  /** true = เพิ่งนำทางกลับมา /home จากหน้าอื่น — คืน scroll หลังฟีดพร้อม (ไม่คืนตอน skeleton/ก่อน virtualizer) */
  const pendingHomeRouteScrollRestoreRef = useRef(false);
  /** ห่อฟีดแนะนำ+ขายแล้ว — ซ่อนชั่วคราวระหว่างคืน scroll ลึกเพื่อไม่ให้ virtualizer วาดโพสบนสุดแล้วกระโดด */
  const feedRestoreWrapRef = useRef<HTMLDivElement | null>(null);
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
  const mainTabScroll = useMainTabScroll();
  const headerVisibility = useHeaderVisibilityContext();

  /** สลับจากหน้าอื่นกลับมาหน้าโฮม → แสดง header/nav ทันที และกันไม่ให้ scroll ที่เกิดจากการ restore ซ่อน header (ให้หายเฉพาะตอนผู้ใช้เลื่อนจริง) */
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname === '/home' && prev !== '/home' && prev != null) {
      pendingHomeRouteScrollRestoreRef.current = true;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      suppressHideUntilRef.current = now + 500;
      headerVisibility?.setHeaderVisible(true);
    }
    if (pathname !== '/home') {
      pendingHomeRouteScrollRestoreRef.current = false;
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

  /** สลับแท็บแล้ว: คืนค่า scroll — ทั้งພ້ອມຂາຍ/ຂາຍແລ້ວ ใช้ retry + ref บังคับ reflow เหมือนกัน (virtualizer / scrollHeight) */
  const recommendPanelRef = useRef<HTMLDivElement | null>(null);
  const soldPanelRef = useRef<HTMLDivElement | null>(null);
  const setHeaderVisibleRef = useRef(headerVisibility?.setHeaderVisible);
  setHeaderVisibleRef.current = headerVisibility?.setHeaderVisible;
  useLayoutEffect(() => {
    const showSold = isSoldTabNoSearch;
    const prev = prevShowSoldRef.current;
    prevShowSoldRef.current = showSold;
    if (prev === null) return;
    if (prev === showSold) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    suppressHideUntilRef.current = now + 400;
    const toRestore = showSold ? soldScrollRef.current : recommendScrollRef.current;
    const activePanelRef = showSold ? soldPanelRef : recommendPanelRef;

    const showHeaderAfterRestore = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeaderVisibleRef.current?.(true));
      });
    };

    if (typeof window === 'undefined' || !Number.isFinite(toRestore)) {
      showHeaderAfterRestore();
      return;
    }

    const targetY = toRestore;
    let attempts = 0;
    const maxAttempts = 25;
    const tryScroll = () => {
      const el = activePanelRef.current;
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
  }, [isSoldTabNoSearch, headerVisibility]);

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  /** ส่งเข้า useHeaderScroll — ตอนโหลดโพสถัดไปจะไม่ขยับ header/bottom nav ตาม scroll ปลอมจาก layout */
  const effectiveLoadingMore = isSoldTabNoSearch ? soldListData.loadingMore : postList.loadingMore;
  /** ไม่ disableScrollHide ตอนเปิด sheet — จะบังคับ header แสดงและเลื่อนลงมาแม้เคยซ่อนจาก scroll; body ล็อก overflow อยู่แล้ว */
  const headerScroll = useHeaderScroll({
    loadingMore: effectiveLoadingMore,
    /** โพสเพิ่มในลิสต์ → กัน scroll ปลอมช่วง layout/รูปนิ่ง */
    feedPostCount: isSoldTabNoSearch ? soldListData.posts.length : postList.posts.length,
    onVisibilityChange: (visible) => headerVisibility?.setHeaderVisible(visible),
    suppressHideUntilRef,
  });

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

  const searchWaitingResults =
    hasSearch && posts.length === 0 && !searchResolvedForEmpty;

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

  const showFeedSkeleton =
    !isSoldTabNoSearch &&
    (searchWaitingResults ||
      (posts.length === 0 &&
        (postList.loadingMore || (!firstFeedLoaded && !(tab === 'sold' && hasSearch)))) ||
      (tabRefreshing && postList.loadingMore));

  /** ก่อน paint: ซ่อนฟีดชั่วคราวเมื่อจะคืน scroll ลึก — กัน virtualizer วาดโพสบนสุดแวบหนึ่ง */
  useLayoutEffect(() => {
    if (pathname !== '/home') {
      const w = feedRestoreWrapRef.current;
      if (w) w.style.visibility = '';
      return;
    }
    if (!pendingHomeRouteScrollRestoreRef.current) return;
    if (!clientMounted) return;
    if (!firstFeedLoaded) return;
    if (showFeedSkeleton) return;
    const targetY = readMainTabScrollStorage('/home');
    if (typeof targetY !== 'number' || !Number.isFinite(targetY)) return;
    const wrap = feedRestoreWrapRef.current;
    if (targetY > 48 && wrap) wrap.style.visibility = 'hidden';
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton]);

  /** คืน scroll หลัง layout นิ่ง — panel ref ตามแท็บที่เปิด (ພ້ອມຂາຍ / ຂາຍແລ້ວ) เหมือนตอนสลับแท็บ */
  useEffect(() => {
    if (pathname !== '/home') return;
    if (!pendingHomeRouteScrollRestoreRef.current) return;
    if (!clientMounted) return;
    if (!firstFeedLoaded) return;
    if (showFeedSkeleton) return;

    const targetY = readMainTabScrollStorage('/home');
    if (typeof targetY !== 'number' || !Number.isFinite(targetY)) {
      pendingHomeRouteScrollRestoreRef.current = false;
      return;
    }

    let cancelled = false;
    const useMask = targetY > 48;
    const activePanelRef = isSoldTabNoSearch ? soldPanelRef : recommendPanelRef;

    const unmask = () => {
      const w = feedRestoreWrapRef.current;
      if (useMask && w) w.style.visibility = '';
    };

    let attempts = 0;
    const maxAttempts = 40;
    const tryScroll = () => {
      if (cancelled) return;
      const el = activePanelRef.current;
      if (el) void el.offsetHeight;
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
      attempts += 1;
      const current = window.scrollY;
      const diff = Math.abs(current - targetY);
      if (diff > 3 && attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        unmask();
        pendingHomeRouteScrollRestoreRef.current = false;
        if (diff <= 4) {
          mainTabScroll?.saveCurrentScroll('/home');
        }
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(tryScroll);
    });

    return () => {
      cancelled = true;
      unmask();
    };
  }, [pathname, clientMounted, firstFeedLoaded, showFeedSkeleton, mainTabScroll, isSoldTabNoSearch]);

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
