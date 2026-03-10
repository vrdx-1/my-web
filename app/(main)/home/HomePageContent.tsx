'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';

/** Load PostFeed only on client to avoid React "Expected static flag was missing" (SSR/hydration). */
const PostFeed = dynamic(
  () => import('@/components/PostFeed').then((mod) => ({ default: mod.PostFeed })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { InteractionModal } from '@/components/modals/InteractionModal';

import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLikedSaved } from '@/hooks/useHomeLikedSaved';
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
import { useFirstFeedLoaded } from '@/contexts/FirstFeedLoadedContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import type { ComponentProps } from 'react';

export type HomeTab = 'recommend' | 'sold';

/** Render PostFeed only after client mount to avoid React "Expected static flag was missing". */
function HomeFeedBody({
  showSkeleton,
  skeletonCount,
  postFeedProps,
}: {
  showSkeleton: boolean;
  skeletonCount: number;
  postFeedProps: ComponentProps<typeof PostFeed>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (showSkeleton) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  // ไม่เรนเดอร์ PostFeed จนกว่าจะ mount บน client — ลด static flag error
  if (!mounted) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  return (
    <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
      <PostFeed {...postFeedProps} />
    </div>
  );
}

export function HomePageContent() {
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const postsRef = useRef<any[]>([]);
  const prevLoadingMoreRef = useRef(false);
  const { session, sessionReady, startSessionCheck } = useSessionAndProfile();
  const { firstFeedLoaded, setFirstFeedLoaded } = useFirstFeedLoaded();
  const mainTab = useMainTabContext();
  const tab = mainTab?.homeTab ?? 'recommend';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') ?? '';
  const hadSearchRef = useRef(false);

  // โหลด liked/saved ครั้งเดียว แชร์ให้ home + search + sold (ลด request ซ้ำ 3 ชุด)
  const sharedLikedSaved = useHomeLikedSaved(session, sessionReady);

  // เฉพาะตอนที่เพิ่งมีคำค้น (จากไม่มีเป็นมี) → สลับไปแท็บพร้อมขาย ไม่บังคับเมื่อ user กดไปดูแท็บขายแล้ว
  useEffect(() => {
    const hasSearch = searchQuery.trim().length > 0;
    if (hasSearch && !hadSearchRef.current) {
      hadSearchRef.current = true;
      mainTab?.setHomeTab('recommend');
    }
    if (!hasSearch) hadSearchRef.current = false;
  }, [searchQuery, mainTab]);

  const recommendFeed = useHomeFeed({
    session,
    sessionReady,
    province: selectedProvince,
    onInitialLoadDone: () => {
      startSessionCheck();
      setFirstFeedLoaded(true);
    },
    sharedLikedSaved,
  });
  const searchData = useSearchPosts({
    query: searchQuery,
    province: selectedProvince,
    session,
    sessionReady,
    sharedLikedSaved,
    enabled: searchQuery.trim().length > 0,
  });
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    status: 'sold',
    sharedLikedSaved,
  });

  const hasSearch = searchQuery.trim().length > 0;

  // ฝั่งพร้อมขาย: มีคำค้น = แสดงเฉพาะโพส status recommend ที่ตรงคำค้น (ไม่เอา sold มาแสดงฝั่งนี้)
  const recommendSource =
    hasSearch
      ? {
          posts: searchData.posts.filter((p: any) => p.status === 'recommend'),
          setPosts: (fn: any) => {
            searchData.setPosts((prev: any[]) => {
              const recommendOnly = prev.filter((p: any) => p.status === 'recommend');
              const next = typeof fn === 'function' ? fn(recommendOnly) : fn;
              if (!Array.isArray(next)) return prev;
              const byId = new Map(next.map((p: any) => [p.id, p]));
              return prev.map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
            });
          },
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

  // ฝั่งขายแล้ว: มีคำค้น = แสดงเฉพาะโพสขายแล้วที่ตรงคำค้น (กรองจากผลค้นหา), ไม่มีคำค้น = รายการขายแล้วทั้งหมด
  const soldSource = hasSearch
    ? {
        posts: searchData.posts.filter((p: any) => p.status === 'sold'),
        setPosts: (fn: any) => {
          searchData.setPosts((prev: any[]) => {
            const soldOnly = prev.filter((p: any) => p.status === 'sold');
            const next = typeof fn === 'function' ? fn(soldOnly) : fn;
            if (!Array.isArray(next)) return prev;
            const byId = new Map(next.map((p: any) => [p.id, p]));
            return prev.map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
          });
        },
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
    : soldListData;

  const posts = tab === 'recommend' ? recommendSource.posts : soldSource.posts;
  const postList = tab === 'recommend' ? recommendSource : soldSource;
  postsRef.current = posts;
  const postListRef = useRef(postList);
  postListRef.current = postList;

  // อัปเดต last_seen ทุก 60 วินาที (ไม่ใช้ state tick เพื่อลด re-render ทั้งฟีด — อัปเดตผ่าน setPosts อย่างเดียว)
  useEffect(() => {
    const refreshOnlineStatus = async () => {
      const list = postsRef.current;
      if (!list?.length) return;
      const userIds = [...new Set(list.map((p: any) => p.user_id).filter(Boolean))];
      if (userIds.length === 0) return;
      try {
        const res = await fetch('/api/profiles/last-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });
        if (!res.ok) return;
        const { lastSeen } = await res.json();
        if (!lastSeen || typeof lastSeen !== 'object') return;
        const setPosts = postListRef.current?.setPosts;
        if (typeof setPosts !== 'function') return;
        setPosts((prev: any[]) =>
          prev.map((p: any) => {
            const uid = p.user_id;
            if (uid && lastSeen[uid] !== undefined) {
              return { ...p, profiles: { ...p.profiles, last_seen: lastSeen[uid] } };
            }
            return p;
          })
        );
      } catch (_) {
        // ignore
      }
    };

    const id = setInterval(refreshOnlineStatus, 60 * 1000);
    const firstRefresh = setTimeout(refreshOnlineStatus, 15 * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(firstRefresh);
    };
  }, []);

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const headerVisibility = useHeaderVisibilityContext();
  const interactionModalHook = useInteractionModal();
  const isBottomSheetOpen = interactionModalHook.interactionModal.show;
  const headerScroll = useHeaderScroll({
    disableScrollHide: isBottomSheetOpen,
    onVisibilityChange: (visible) => headerVisibility?.setHeaderVisible(visible),
  });

  // ตอนเปิด Bottom sheet: แช่สถานะ Header — ถ้าแสดงอยู่ก็คงแสดง ถ้าซ่อนอยู่ก็คงซ่อน (ไม่ให้ scroll เปลี่ยน)
  // ไม่มี useEffect บังคับ setHeaderVisible เพื่อรักษาสถานะเดิม

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
    if (tab !== 'sold' || !sessionReady || soldListData.session === undefined || hasSearch) return;
    if (soldListData.posts.length > 0) return;
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
  }, [tab, sessionReady, soldListData.session, hasSearch, soldListData.posts.length]);

  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = postList.loadingMore;
    if (wasLoading && !postList.loadingMore) {
      setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setTabRefreshing(false);
      mainTab?.setRefreshSource(null);
    } else if (!postList.loadingMore) {
      setTabRefreshing(false);
      mainTab?.setTabRefreshing(false);
      // เคลียร์ spinner บนแท็บด้วย (กรณีสลับมาแท็บขายแล้วที่มีคำค้น — โหลดอยู่แล้วจึงไม่เคย wasLoading)
      mainTab?.setNavigatingToTab(null);
      mainTab?.setRefreshSource(null);
    }
  }, [postList.loadingMore, mainTab]);

  const doRefresh = useCallback((options?: { fromHomeButton?: boolean }) => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    // ทุกชนิด refresh (กดโลโก้ / ดึงลง / กดแท็บ) → ฟิลเตอร์ ທຸກແຂວງ + ล้างคำค้นหา
    homeProvince?.setSelectedProvince('');
    const clearedSearch = searchParams.has('q');
    if (clearedSearch) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      const queryString = params.toString();
      const newUrl = pathname + (queryString ? `?${queryString}` : '');
      window.history.replaceState(null, '', newUrl);
      router.replace(newUrl, { scroll: false });
    }
    if (options?.fromHomeButton) {
      mainTab?.setRefreshSource('home');
      mainTab?.setHomeTab('recommend'); // กดโลโก้ = กลับไป default ฝั่ง ພ້ອມຂາຍ
    } else {
      mainTab?.setRefreshSource('pull');
    }
    setTabRefreshing(true);
    const useNormalFeed = clearedSearch || !searchQuery.trim();
    const effectiveTab = options?.fromHomeButton ? 'recommend' : tab;
    if (effectiveTab === 'recommend') {
      if (useNormalFeed) {
        recommendFeed.setPage(0);
        recommendFeed.setHasMore(true);
        recommendFeed.fetchPosts(true).finally(() => mainTab?.setRefreshSource(null));
      } else {
        searchData.fetchSearch().finally(() => mainTab?.setRefreshSource(null));
      }
    } else {
      if (useNormalFeed) {
        soldListData.setPage(0);
        soldListData.setHasMore(true);
        soldListData.fetchPosts(true).finally(() => mainTab?.setRefreshSource(null));
      } else {
        searchData.fetchSearch().finally(() => mainTab?.setRefreshSource(null));
      }
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
      mainTab?.setRefreshSource('home');
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

  const showFeedSkeleton =
    (posts.length === 0 && (postList.loadingMore || (!firstFeedLoaded && !(tab === 'sold' && hasSearch)))) ||
    (mainTab?.refreshSource === 'home' && tabRefreshing && postList.loadingMore);

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div>
        <HomeFeedBody
          showSkeleton={showFeedSkeleton}
          skeletonCount={5}
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
            onLoadMore: () => postList.setPage((p) => p + 1),
            hideBoost: tab === 'sold',
            isFeedScrollIdle: true,
          }}
        />
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
