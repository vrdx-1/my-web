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

/** Stub sold source เมื่อยังไม่เปิดแท็บขายแล้ว — ใช้ตอนมีคำค้น (sold จาก search) */
const SOLD_STUB = {
  posts: [] as any[],
  setPosts: (_: any) => {},
  session: undefined as any,
  likedPosts: {} as { [key: string]: boolean },
  savedPosts: {} as { [key: string]: boolean },
  setLikedPosts: (_: any) => {},
  setSavedPosts: (_: any) => {},
  loadingMore: false,
  hasMore: false,
  setPage: (_: any) => {},
  fetchPosts: (_?: boolean) => Promise.resolve(),
};

/** โหลดข้อมูลแท็บขายแล้วเฉพาะเมื่อเปิดแท็บนี้ (lazy) — ลดงานตอนโหลดหน้าโฮม */
function SoldTabFeedWrapper({
  session,
  sessionReady,
  sharedLikedSaved,
  soldTabRefreshRef,
  onLoadingMoreChange,
  onPostsChange,
  menu,
  viewingPostHook,
  headerScroll,
  fullScreenViewer,
  reportingPost,
  setReportingPost,
  reportReason,
  setReportReason,
  isSubmittingReport,
  setIsSubmittingReport,
  justLikedPosts,
  setJustLikedPosts,
  justSavedPosts,
  setJustSavedPosts,
  fetchInteractions,
  postsRef,
  handleSubmitReportRef,
}: {
  session: any;
  sessionReady: boolean;
  sharedLikedSaved: ReturnType<typeof useHomeLikedSaved>;
  soldTabRefreshRef: React.MutableRefObject<{ setPage: (v: number | ((p: number) => number)) => void; setHasMore: (v: boolean) => void; fetchPosts: (isInitial?: boolean) => Promise<void> } | null>;
  onLoadingMoreChange: (loading: boolean) => void;
  onPostsChange: (posts: any[]) => void;
  menu: ReturnType<typeof useMenu>;
  viewingPostHook: ReturnType<typeof useViewingPost>;
  headerScroll: ReturnType<typeof useHeaderScroll>;
  fullScreenViewer: ReturnType<typeof useFullScreenViewer>;
  reportingPost: any;
  setReportingPost: (p: any) => void;
  reportReason: string;
  setReportReason: (r: string) => void;
  isSubmittingReport: boolean;
  setIsSubmittingReport: (v: boolean) => void;
  justLikedPosts: { [key: string]: boolean };
  setJustLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  justSavedPosts: { [key: string]: boolean };
  setJustSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  fetchInteractions: (type: 'likes' | 'saves', postId: string) => Promise<void>;
  postsRef: React.MutableRefObject<any[]>;
  handleSubmitReportRef: React.MutableRefObject<(() => void) | null>;
}) {
  const soldListData = usePostListData({
    type: 'sold',
    session,
    sessionReady,
    status: 'sold',
    sharedLikedSaved,
  });

  useEffect(() => {
    soldTabRefreshRef.current = {
      setPage: soldListData.setPage,
      setHasMore: soldListData.setHasMore,
      fetchPosts: soldListData.fetchPosts,
    };
    soldListData.setPage(0);
    soldListData.setHasMore(true);
    soldListData.fetchPosts(true);
    return () => {
      soldTabRefreshRef.current = null;
    };
  }, []);

  useEffect(() => {
    onLoadingMoreChange(soldListData.loadingMore);
  }, [soldListData.loadingMore, onLoadingMoreChange]);

  useEffect(() => {
    onPostsChange(soldListData.posts);
  }, [soldListData.posts, onPostsChange]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: soldListData.loadingMore,
    hasMore: soldListData.hasMore,
    onLoadMore: () => soldListData.setPage((p) => p + 1),
  });

  const { toggleLike, toggleSave } = usePostInteractions({
    session: soldListData.session,
    posts: soldListData.posts,
    setPosts: soldListData.setPosts,
    likedPosts: soldListData.likedPosts,
    savedPosts: soldListData.savedPosts,
    setLikedPosts: soldListData.setLikedPosts,
    setSavedPosts: soldListData.setSavedPosts,
    setJustLikedPosts,
    setJustSavedPosts,
  });

  const handlers = usePostFeedHandlers({
    session: soldListData.session,
    posts: soldListData.posts,
    setPosts: soldListData.setPosts,
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

  useEffect(() => {
    handleSubmitReportRef.current = handlers.handleSubmitReport;
  }, [handlers.handleSubmitReport]);

  const showSkeleton = soldListData.posts.length === 0 && soldListData.loadingMore;

  return (
    <>
    <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
      <HomeFeedBody
        showSkeleton={showSkeleton}
        skeletonCount={3}
        postFeedProps={{
          posts: soldListData.posts,
          session: soldListData.session,
          likedPosts: soldListData.likedPosts,
          savedPosts: soldListData.savedPosts,
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
          loadingMore: soldListData.hasMore ? soldListData.loadingMore : false,
          hasMore: soldListData.hasMore ?? true,
          onLoadMore: () => soldListData.setPage((p) => p + 1),
          hideBoost: true,
          isFeedScrollIdle: true,
        }}
      />
    </div>
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
    </>
  );
}

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

  const hasSearch = searchQuery.trim().length > 0;
  const soldTabRefreshRef = useRef<{ setPage: (v: number | ((p: number) => number)) => void; setHasMore: (v: boolean) => void; fetchPosts: (isInitial?: boolean) => Promise<void> } | null>(null);
  const handleSubmitReportRef = useRef<(() => void) | null>(null);
  const [soldTabLoadingMore, setSoldTabLoadingMore] = useState(false);
  const [soldTabPosts, setSoldTabPosts] = useState<any[]>([]);

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

  // ฝั่งขายแล้ว: มีคำค้น = แสดงเฉพาะโพสขายแล้วที่ตรงคำค้น; ไม่มีคำค้น = ใช้ stub (ข้อมูลจริงโหลดใน SoldTabFeedWrapper เมื่อเปิดแท็บ)
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
    : SOLD_STUB;

  const isSoldTabNoSearch = tab === 'sold' && !hasSearch;
  const posts = tab === 'recommend' ? recommendSource.posts : isSoldTabNoSearch ? soldTabPosts : soldSource.posts;
  const postList = tab === 'recommend' ? recommendSource : isSoldTabNoSearch ? SOLD_STUB : soldSource;
  postsRef.current = posts;

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

  const effectiveLoadingMore = isSoldTabNoSearch ? soldTabLoadingMore : postList.loadingMore;

  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = effectiveLoadingMore;
    if (wasLoading && !effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setTabRefreshing(false);
      mainTab?.setRefreshSource(null);
    } else if (!effectiveLoadingMore) {
      setTabRefreshing(false);
      mainTab?.setTabRefreshing(false);
      mainTab?.setNavigatingToTab(null);
      mainTab?.setRefreshSource(null);
    }
  }, [effectiveLoadingMore, mainTab]);

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
        soldTabRefreshRef.current?.setPage(0);
        soldTabRefreshRef.current?.setHasMore(true);
        soldTabRefreshRef.current?.fetchPosts(true).finally(() => mainTab?.setRefreshSource(null));
      } else if (!useNormalFeed) {
        searchData.fetchSearch().finally(() => mainTab?.setRefreshSource(null));
      }
    }
  }, [tab, mainTab, pathname, recommendFeed, searchData, searchQuery, searchParams, router, homeProvince]);

  useEffect(() => {
    mainTab?.registerTabRefreshHandler(doRefresh);
    return () => mainTab?.unregisterTabRefreshHandler();
  }, [mainTab, doRefresh]);

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
        soldTabRefreshRef.current?.setPage(0);
        soldTabRefreshRef.current?.setHasMore(true);
        soldTabRefreshRef.current?.fetchPosts(true);
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
      // sold: fetch ถูกเรียกใน SoldTabFeedWrapper เมื่อ mount
    }
  }, [tab, mainTab, searchQuery, recommendFeed, searchData]);

  useEffect(() => {
    mainTab?.registerTabChangeHandler(setTabAndRefresh);
    return () => mainTab?.unregisterTabChangeHandler();
  }, [mainTab, setTabAndRefresh]);

  const showFeedSkeleton =
    !isSoldTabNoSearch &&
    ((posts.length === 0 && (postList.loadingMore || (!firstFeedLoaded && !(tab === 'sold' && hasSearch)))) ||
      (mainTab?.refreshSource === 'home' && tabRefreshing && postList.loadingMore));

  // ไม่ render เนื้อหาลง DOM จนกว่าจะ mount บน client (ลด hydration / static flag issues)
  if (!clientMounted) return null;

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div>
        {isSoldTabNoSearch ? (
          <SoldTabFeedWrapper
            session={session}
            sessionReady={sessionReady}
            sharedLikedSaved={sharedLikedSaved}
            soldTabRefreshRef={soldTabRefreshRef}
            onLoadingMoreChange={setSoldTabLoadingMore}
            onPostsChange={setSoldTabPosts}
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
        ) : (
          <HomeFeedBody
            showSkeleton={showFeedSkeleton}
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
              onLoadMore: () => postList.setPage((p) => p + 1),
              hideBoost: tab === 'sold',
              isFeedScrollIdle: true,
            }}
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

      {/* โหลด modal tree เมื่อจำเป็นเท่านั้น — ลดงานเรนเดอร์ตอนเลื่อนฟีด */}
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
        onReportSubmit={isSoldTabNoSearch ? () => handleSubmitReportRef.current?.() : handlers.handleSubmitReport}
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
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
    </main>
  );
}
