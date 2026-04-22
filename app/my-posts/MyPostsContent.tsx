'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Shared Components
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { TabNavigation } from '@/components/TabNavigation';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

// Shared Hooks
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';
import { getOwnedProfileIds } from '@/utils/postUtils';

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** ใช้ MyPostsFeedBlock (ไม่ใช้ PostFeed) เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
const MyPostsFeedBlock = dynamic(
  () => import('./MyPostsFeedBlock').then((mod) => ({ default: mod.MyPostsFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

export function MyPostsContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [tab, setTab] = useState('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [hasFetchedRecommend, setHasFetchedRecommend] = useState(false);
  const [hasFetchedSold, setHasFetchedSold] = useState(false);
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const { session, sessionReady, activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();
  const ownershipScopeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setFeedReady(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  const recommendListData = usePostListData({
    type: 'my-posts',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'recommend',
  });
  const soldListData = usePostListData({
    type: 'my-posts',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'sold',
  });

  const ownershipScopeKey = (() => {
    const resolvedAuthUserId = authUserId || session?.user?.id || null;
    const ownedProfileIds = getOwnedProfileIds({
      activeProfileId,
      authUserId: resolvedAuthUserId,
      availableProfiles,
    });
    if (ownedProfileIds.length > 0) {
      return ownedProfileIds.slice().sort().join(',');
    }
    return activeProfileId || resolvedAuthUserId || 'guest';
  })();

  const postListData = tab === 'recommend' ? recommendListData : soldListData;
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const setHeaderVisible = useSetHeaderVisibility();
  const headerScroll = useHeaderScroll({ disableScrollHide: true, hideOnScrollUp: false });

  const lockHeaderVisible = (visible: boolean) => {
    void visible;
    headerScroll.setIsHeaderVisible(true);
    setHeaderVisible?.(true);
  };

  const lockedHeaderScroll = {
    ...headerScroll,
    isHeaderVisible: true,
    setIsHeaderVisible: lockHeaderVisible,
  };

  useEffect(() => {
    setHeaderVisible?.(true);
    return () => {
      setHeaderVisible?.(true);
    };
  }, [setHeaderVisible]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage((prevPage) => prevPage + 1),
  });

  const { toggleSave } = usePostInteractions({
    session: postListData.session,
    activeProfileId,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    savedPosts: postListData.savedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustSavedPosts,
  });

  useEffect(() => {
    if (!sessionReady || recommendListData.session === undefined) return;
    if (!hasFetchedRecommend && tab === 'recommend' && recommendListData.posts.length === 0 && !recommendListData.loadingMore) {
      setHasFetchedRecommend(true);
      recommendListData.setPage(0);
      recommendListData.setHasMore(true);
      recommendListData.fetchPosts(true);
    }
  }, [sessionReady, recommendListData.session, tab, recommendListData.posts.length, recommendListData.loadingMore, hasFetchedRecommend]);

  useEffect(() => {
    if (!sessionReady || recommendListData.session === undefined) return;
    if (ownershipScopeKeyRef.current === null) {
      ownershipScopeKeyRef.current = ownershipScopeKey;
      return;
    }
    if (ownershipScopeKeyRef.current === ownershipScopeKey) return;

    ownershipScopeKeyRef.current = ownershipScopeKey;
    setHasFetchedRecommend(false);
    setHasFetchedSold(false);
    setTabRefreshing(true);

    recommendListData.setPosts([]);
    recommendListData.setPage(0);
    recommendListData.setHasMore(true);

    soldListData.setPosts([]);
    soldListData.setPage(0);
    soldListData.setHasMore(true);
  }, [
    ownershipScopeKey,
    sessionReady,
    recommendListData.session,
    recommendListData.setPosts,
    recommendListData.setPage,
    recommendListData.setHasMore,
    soldListData.setPosts,
    soldListData.setPage,
    soldListData.setHasMore,
  ]);

  useEffect(() => {
    if (tab !== 'sold' || !sessionReady || soldListData.session === undefined) return;
    if (!hasFetchedSold && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      setHasFetchedSold(true);
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, sessionReady, soldListData.session, soldListData.posts.length, soldListData.loadingMore, hasFetchedSold]);

  useEffect(() => {
    if (!postListData.loadingMore) setTabRefreshing(false);
  }, [postListData.loadingMore]);

  useEffect(() => {
    if (recommendListData.page > 0 && !recommendListData.loadingMore && recommendListData.session !== undefined) {
      recommendListData.fetchPosts(false, recommendListData.page);
    }
  }, [recommendListData.page, recommendListData.session]);

  useEffect(() => {
    if (soldListData.page > 0 && !soldListData.loadingMore && soldListData.session !== undefined) {
      soldListData.fetchPosts(false, soldListData.page);
    }
  }, [soldListData.page, soldListData.session]);

  const handlers = usePostFeedHandlers({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    viewingPostHook,
    headerScroll: lockedHeaderScroll,
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
    setIsHeaderVisible: lockHeaderVisible,
  });

  const { addBackStep } = useBackHandler();

  // iOS: ตั้ง touch-action ที่ body เพื่อให้ single tap ทำงานได้ ไม่ต้อง double tap (เฉพาะหน้านี้)
  useEffect(() => {
    const prev = document.body.style.touchAction;
    document.body.style.touchAction = 'manipulation';
    return () => {
      document.body.style.touchAction = prev;
    };
  }, []);

  const handleBack = useCallback(() => {
    router.push('/profile');
  }, [router]);
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
    const close = () => viewingPostHook.closeViewingMode();
    return addBackStep(close);
  }, [viewingPostHook.viewingPost]);

  const isFeedSkeleton = postListData.posts.length === 0 && postListData.loadingMore;
  const showFeedSkeleton =
    !mounted ||
    !feedReady ||
    !sessionReady ||
    isFeedSkeleton ||
    (tab === 'recommend' ? !hasFetchedRecommend : !hasFetchedSold);
  const isHeaderVisible = lockedHeaderScroll.isHeaderVisible;
  const headerSpacerStyle = {
    height: LAYOUT_CONSTANTS.HEADER_HEIGHT,
    pointerEvents: 'none' as const,
  };

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
          boxSizing: 'border-box',
          zIndex: 100,
          background: '#ffffff',
          backgroundColor: '#ffffff',
          transform: isHeaderVisible ? 'translateX(-50%)' : 'translate(-50%, -100%)',
          pointerEvents: isHeaderVisible ? 'auto' : 'none',
        }}
      >
        <PageHeader title="ໂພສຂອງຂ້ອຍ" centerTitle onBack={handleBack} showDivider={false} />
        <TabNavigation
          className="home-tab-navigation"
          tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab={tab}
          onTabChange={(v) => {
            if (v === tab) {
              setTabRefreshing(true);
              const list = v === 'recommend' ? recommendListData : soldListData;
              list.setPage(0);
              list.setHasMore(true);
              list.fetchPosts(true);
              if (v === 'recommend') setHasFetchedRecommend(true);
              if (v === 'sold') setHasFetchedSold(true);
            } else {
              setTab(v);
              const targetList = v === 'recommend' ? recommendListData : soldListData;
              if (targetList.posts.length === 0) setTabRefreshing(true);
            }
          }}
          loadingTab={tabRefreshing ? tab : null}
        />
      </div>

      <div style={headerSpacerStyle} aria-hidden />

      {showFeedSkeleton ? (
        <FeedSkeleton count={3} />
      ) : (
        <MyPostsFeedBlock
          showSkeleton={postListData.posts.length === 0 && postListData.loadingMore}
          skeletonCount={3}
          posts={postListData.posts}
          session={postListData.session}
          savedPosts={postListData.savedPosts}
          justSavedPosts={justSavedPosts}
          activeMenuState={menu.activeMenuState}
          isMenuAnimating={menu.isMenuAnimating}
          lastPostElementRef={lastPostElementRef}
          menuButtonRefs={menu.menuButtonRefs}
          onViewPost={handlers.handleViewPost}
          onSave={toggleSave}
          onShare={handlers.handleShare}
          onTogglePostStatus={handlers.handleTogglePostStatus}
          onDeletePost={handlers.handleDeletePost}
          onReport={handlers.handleReport}
          onRepost={handlers.handleRepost}
          onSetActiveMenu={menu.setActiveMenu}
          onSetMenuAnimating={menu.setIsMenuAnimating}
          loadingMore={postListData.hasMore ? postListData.loadingMore : false}
          hasMore={postListData.hasMore}
          onLoadMore={() => postListData.setPage((p) => p + 1)}
          hideBoost={tab === 'sold'}
        />
      )}

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={postListData.session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => {
          viewingPostHook.closeViewingMode();
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

      {/* ป๊อบอัพแสดงผลสำเร็จการส่งรายงาน */}
      {handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}

      {/* Modal ยืนยันการลบโพสต์ */}
      {handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
        />
      )}

      {/* ป๊อบอัพแสดงผลสำเร็จการลบโพสต์ */}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
      {handlers.showRepostSuccess && (
        <SuccessPopup message="ໂພສໃໝ່ສຳເລັດ" onClose={() => handlers.setShowRepostSuccess?.(false)} />
      )}
    </main>
  );
}
