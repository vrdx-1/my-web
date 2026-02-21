'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PostFeed } from '@/components/PostFeed';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useHomeData } from '@/hooks/useHomeData';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useMainTabContext } from '@/contexts/MainTabContext';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { FeedSkeleton } from '@/components/FeedSkeleton';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { PROFILE_PATH } from '@/utils/authRoutes';
import { fetchNotificationFeed } from '@/utils/notificationFeed';

function countUnreadFromList(list: { post_id: string; created_at: string; notification_count?: number }[], afterTime?: number): number {
  const set = new Set<string>();
  list.forEach((n) => {
    if ((n.notification_count ?? 0) <= 0) return;
    if (afterTime != null && new Date(n.created_at).getTime() <= afterTime) return;
    set.add(n.post_id);
  });
  return set.size;
}

export function SoldPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const mainTab = useMainTabContext();
  const headerVisibility = useHeaderVisibilityContext();
  const searchTerm = mainTab?.searchTerm ?? '';

  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [refreshSource, setRefreshSource] = useState<'pull' | null>(null);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const hasFetchedRef = useRef(false);

  const homeData = useHomeData('');

  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    const userId = homeData.session?.user?.id;
    if (!userId) { setUnreadCount(0); return; }
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('notification_cleared_posts') : null;
      const clearedMap: Record<string, string> = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      const { list } = await fetchNotificationFeed(userId, clearedMap);
      let afterTime: number | undefined;
      if (typeof window !== 'undefined') {
        const lastOpenedRaw = window.localStorage.getItem('notification_home_last_opened_at');
        if (lastOpenedRaw) {
          const t = new Date(lastOpenedRaw).getTime();
          if (!Number.isNaN(t) && t > 0) afterTime = t;
        }
      }
      setUnreadCount(countUnreadFromList(list, afterTime));
    } catch {
      setUnreadCount(0);
    }
  }, [homeData.session]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (pathname !== '/sold') return;
    const onFocus = () => fetchUnreadCount();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnreadCount();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathname, fetchUnreadCount]);

  const postListData = usePostListData({
    type: 'sold',
    session: homeData.session,
    status: 'sold',
    searchTerm: searchTerm || undefined,
  });
  const postsRef = useRef<any[]>([]);
  postsRef.current = postListData.posts;

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const interactionModalHook = useInteractionModal();
  const fileUpload = useFileUpload();
  const headerScroll = useHeaderScroll({
    loadingMore: postListData.loadingMore,
    disableScrollHide: false,
    onVisibilityChange: (v) => headerVisibility?.setHeaderVisible(v),
  });

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
  });

  const { toggleLike, toggleSave } = usePostInteractions({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    likedPosts: postListData.likedPosts,
    savedPosts: postListData.savedPosts,
    setLikedPosts: postListData.setLikedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustLikedPosts,
    setJustSavedPosts,
  });

  useEffect(() => {
    if (postListData.session !== undefined) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
      hasFetchedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, postListData.session]);

  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore && postListData.session !== undefined) {
      postListData.fetchPosts(false);
    }
  }, [postListData.page, postListData.session]);

  const fetchInteractions = useCallback(
    async (type: 'likes' | 'saves', postId: string) => {
      await interactionModalHook.fetchInteractions(type, postId, postsRef.current);
    },
    [interactionModalHook],
  );

  const handleLogoClick = useCallback(() => {
    postListData.setPage(0);
    postListData.fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [postListData]);

  useEffect(() => {
    if (!postListData.loadingMore) {
      setTabRefreshing(false);
      setRefreshSource(null);
      mainTab?.setTabRefreshing(false);
      mainTab?.setRefreshSource?.(null);
    }
  }, [postListData.loadingMore, mainTab]);

  const handlePullToRefresh = useCallback(() => {
    setRefreshSource('pull');
    setTabRefreshing(true);
    mainTab?.setTabRefreshing(true);
    mainTab?.setRefreshSource?.('pull');
    mainTab?.setSearchTerm?.('');
    postListData.setPage(0);
    postListData.setHasMore(true);
    postListData.fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [mainTab, postListData]);

  const [isAtTop, setIsAtTop] = useState(true);
  const scrollTopThreshold = 8;
  useEffect(() => {
    const onScroll = () => {
      const atTop = typeof window !== 'undefined' && window.scrollY <= scrollTopThreshold;
      setIsAtTop(atTop);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ใช้กฎเดียวกับ ພ້ອມຂາຍ: ให้ body มี data-page="home" เพื่อ overscroll-behavior-y: none (ไม่ให้ดึงฟีดแยกจาก Header)
  useEffect(() => {
    document.body.setAttribute('data-page', 'home');
    return () => document.body.removeAttribute('data-page');
  }, []);

  // ป้องกัน iOS overscroll bounce เมื่ออยู่บนสุดของ feed (แก้ปัญหา feed แยกจาก header)
  useEffect(() => {
    if (!isAtTop) return;
    
    // ตรวจสอบว่าเป็น iOS หรือไม่
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) return;

    let touchStartY = 0;
    const MIN_PULL_THRESHOLD = 5; // ต้องดึงลงอย่างน้อย 5px ถึงจะป้องกัน bounce

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > scrollTopThreshold) return;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      // ตรวจสอบอีกครั้งว่า scroll position ยังอยู่บนสุดหรือไม่
      if (window.scrollY > scrollTopThreshold) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY;
      
      // ถ้ากำลังดึงลงมากพอ (deltaY > threshold) และอยู่บนสุด ให้ป้องกัน default behavior เพื่อหยุด bounce
      if (deltaY > MIN_PULL_THRESHOLD) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isAtTop, scrollTopThreshold]);

  const pullDisabled = tabRefreshing || !!interactionModalHook.interactionModal.show || isAtTop;
  const { pullDistance } = usePullToRefresh(handlePullToRefresh, pullDisabled);

  const isPullRefreshing = tabRefreshing && refreshSource === 'pull';

  // Sync pullDistance กับ pullHeaderOffset เพื่อให้ header และ feed เลื่อนลงพร้อมกัน (ป้องกัน feed แยกจาก header)
  useEffect(() => {
    if (mainTab) {
      mainTab.setPullHeaderOffset(pullDistance);
    }
    return () => {
      if (mainTab) {
        mainTab.setPullHeaderOffset(0);
      }
    };
  }, [pullDistance, mainTab]);

  // ลงทะเบียน refresh กับ layout (กดแท็บขายแล้วที่ active = refresh)
  useEffect(() => {
    if (!mainTab) return;
    const handler = () => {
      mainTab.setTabRefreshing(true);
      setTabRefreshing(true);
      handleLogoClick();
    };
    mainTab.registerTabRefreshHandler(handler);
    return () => mainTab.unregisterTabRefreshHandler();
  }, [mainTab, handleLogoClick]);

  const handlers = usePostFeedHandlers({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
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
    const close = () => {
      const isFirstPost = postListData.posts.length > 0 && viewingPostHook.viewingPost?.id === postListData.posts[0]?.id;
      viewingPostHook.closeViewingMode();
      if (isFirstPost) headerScroll.setIsHeaderVisible(true);
    };
    return addBackStep(close);
  }, [viewingPostHook.viewingPost?.id ?? null, postListData.posts.length]);

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
      <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
        <input type="file" ref={fileUpload.hiddenFileInputRef} multiple accept="image/*" onChange={fileUpload.handleFileChange} style={{ display: 'none' }} />

      {postListData.posts.length === 0 && postListData.loadingMore ? (
        <FeedSkeleton />
      ) : (
        <PostFeed
          posts={postListData.posts}
          session={postListData.session}
          likedPosts={postListData.likedPosts}
          savedPosts={postListData.savedPosts}
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
          loadingMore={postListData.hasMore ? postListData.loadingMore : false}
          hasMore={postListData.hasMore}
          onLoadMore={() => postListData.setPage((p) => p + 1)}
          hideBoost
        />
      )}

      <InteractionModal
        show={interactionModalHook.interactionModal.show}
        type={interactionModalHook.interactionModal.type}
        postId={interactionModalHook.interactionModal.postId}
        posts={postListData.posts}
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
        session={postListData.session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => {
          const isFirstPost = postListData.posts.length > 0 && viewingPostHook.viewingPost?.id === postListData.posts[0]?.id;
          viewingPostHook.closeViewingMode();
          if (isFirstPost) headerScroll.setIsHeaderVisible(true);
        }}
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
            setTimeout(() => {
              fullScreenViewer.setActivePhotoMenu(null);
            }, 300);
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
    </>
  );
}
