'use client'
import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Shared Components
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PostFeed } from '@/components/PostFeed';
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

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export function LikedPostsContent() {
  const router = useRouter();
  const [tab, setTab] = useState('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Use post list data hook
  const [sessionState, setSessionState] = useState<any>(undefined);
  const hasFetchedRef = useRef(false);
  
  useEffect(() => {
    const initSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSessionState(currentSession);
    };
    initSession();
  }, []);

  const postListData = usePostListData({
    type: 'liked',
    session: sessionState,
    tab,
  });

  // Use menu hook
  const menu = useMenu();

  // Use fullscreen viewer hook
  const fullScreenViewer = useFullScreenViewer();

  // Use viewing post hook
  const viewingPostHook = useViewingPost();

  // Use header scroll hook
  const headerScroll = useHeaderScroll();

  // Use shared infinite scroll hook
  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
    threshold: 0.1,
  });

  // Use shared post interactions hook
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

  // Initialize data when session is ready (first time only)
  useEffect(() => {
    // ตรวจสอบทั้ง sessionState และ postListData.session เพื่อให้แน่ใจว่า session ใน hook ถูก initialize แล้ว
    // sessionState อาจเป็น null (guest) หรือ session object (logged in) 
    // postListData.session ต้องไม่ใช่ undefined (หมายความว่า session ใน hook ถูก initialize แล้ว)
    if (sessionState !== undefined && postListData.session !== undefined && !hasFetchedRef.current) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
      hasFetchedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, postListData.session]);

  // Reset and fetch when tab changes
  useEffect(() => {
    if (hasFetchedRef.current && sessionState !== undefined && postListData.session !== undefined) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!postListData.loadingMore) setTabRefreshing(false);
  }, [postListData.loadingMore]);

  // Load more when page changes
  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore && postListData.session !== undefined) {
      postListData.fetchPosts(false, postListData.page);
    }
  }, [postListData.page, postListData.session]);

  // Use shared post feed handlers
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

  // Use shared post modals hook for managing modal side effects
  usePostModals({
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    setIsViewingModeOpen: viewingPostHook.setIsViewingModeOpen,
    setViewingModeDragOffset: viewingPostHook.setViewingModeDragOffset,
    setViewingModeIsDragging: viewingPostHook.setViewingModeIsDragging,
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
    interactionModalShow: false,
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
  });

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff' }}>
        <PageHeader title="ລາຍການທີ່ມັກ" centerTitle />
<TabNavigation
        tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab={tab}
          onTabChange={(v) => {
            if (v === tab) {
              setTabRefreshing(true);
              postListData.setPage(0);
              postListData.setHasMore(true);
              postListData.fetchPosts(true);
              return;
            }
            setTabRefreshing(true);
            setTab(v);
          }}
          loadingTab={tabRefreshing ? tab : null}
        />
      </div>

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
        onViewLikes={() => {}}
        onViewSaves={() => {}}
        onTogglePostStatus={handlers.handleTogglePostStatus}
        onDeletePost={handlers.handleDeletePost}
        onReport={handlers.handleReport}
        onSetActiveMenu={menu.setActiveMenu}
        onSetMenuAnimating={menu.setIsMenuAnimating}
        loadingMore={postListData.loadingMore}
        hideBoost={tab === 'sold'}
      />

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={postListData.session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        viewingModeIsDragging={viewingPostHook.viewingModeIsDragging}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
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
    </main>
  );
}

