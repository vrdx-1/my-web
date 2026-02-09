'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { PostFeedModals } from '@/components/PostFeedModals';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Avatar } from '@/components/Avatar';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { TermsModal } from '@/components/modals/TermsModal';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { HomeHeader } from '@/components/home/HomeHeader';
import { SearchScreen } from '@/components/SearchScreen';

// Shared Hooks
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

// Shared Utils
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { fetchNotificationFeed } from '@/utils/notificationFeed';

export function SoldPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchScreenOpen, setIsSearchScreenOpen] = useState(false);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const hasFetchedRef = useRef(false);

  // Use home data hook for user profile and session management
  const homeData = useHomeData('');

  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    const userId = homeData.session?.user?.id;
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('notification_cleared_posts') : null;
      const clearedMap: Record<string, string> = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      const { totalUnread } = await fetchNotificationFeed(userId, clearedMap);
      setUnreadCount(totalUnread);
    } catch {
      setUnreadCount(0);
    }
  }, [homeData.session]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Re-fetch when returning to this tab/page
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

  // Use post list data hook for sold posts
  const postListData = usePostListData({
    type: 'sold',
    session: homeData.session,
    status: 'sold',
    searchTerm: searchTerm || undefined,
  });

  // Use menu hook
  const menu = useMenu();

  // Use fullscreen viewer hook
  const fullScreenViewer = useFullScreenViewer();

  // Use viewing post hook
  const viewingPostHook = useViewingPost();

  // Use interaction modal hook
  const interactionModalHook = useInteractionModal();

  // Use file upload hook
  const fileUpload = useFileUpload();

  // Use header scroll hook (ให้ header ซ่อน/แสดงตามการเลื่อนเหมือนแท็บ ພ້ອມຂາຍ)
  const headerScroll = useHeaderScroll({ loadingMore: postListData.loadingMore, disableScrollHide: true });

  // Use shared infinite scroll hook
  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
    threshold: 0.2, // ลด threshold เพื่อให้ trigger เร็วขึ้นเล็กน้อย เมื่อเห็น 20% ของ element สุดท้าย
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

  // Initialize data when search term changes
  useEffect(() => {
    // รอให้ session ใน hook ถูก initialize แล้ว (ไม่ใช่ undefined)
    if (postListData.session !== undefined) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
      hasFetchedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, postListData.session]);

  // Load more when page changes
  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore && postListData.session !== undefined) {
      postListData.fetchPosts(false);
    }
  }, [postListData.page, postListData.session]);

  // Fetch interactions
  const fetchInteractions = useCallback(async (type: 'likes' | 'saves', postId: string) => {
    await interactionModalHook.fetchInteractions(type, postId, postListData.posts);
  }, [postListData.posts, interactionModalHook]);

  // Handlers
  const handleLogoClick = useCallback(() => {
    postListData.setPage(0);
    postListData.fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [postListData]);

  useEffect(() => {
    if (!postListData.loadingMore) setTabRefreshing(false);
  }, [postListData.loadingMore]);

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
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <input type="file" ref={fileUpload.hiddenFileInputRef} multiple accept="image/*" onChange={fileUpload.handleFileChange} style={{ display: 'none' }} />

      <HomeHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreatePostClick={() => fileUpload.handleCreatePostClick(homeData.session, showTermsModal, setShowTermsModal)}
        onNotificationClick={() => {
          if (!homeData.session) {
            router.push('/profile');
            return;
          }
          router.push('/notification');
        }}
        unreadCount={unreadCount}
        userProfile={homeData.userProfile}
        session={homeData.session}
        isHeaderVisible={headerScroll.isHeaderVisible}
        onTabChange={handleLogoClick}
        onSearchClick={() => setIsSearchScreenOpen(true)}
        onTabRefresh={() => {
          setTabRefreshing(true);
          handleLogoClick();
        }}
        loadingTab={tabRefreshing ? 'sold' : null}
      />

      <SearchScreen
        isOpen={isSearchScreenOpen}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClose={() => setIsSearchScreenOpen(false)}
      />

      <div style={LAYOUT_CONSTANTS.HEADER_SPACER}></div>

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
        loadingMore={postListData.loadingMore}
        hasMore={postListData.hasMore}
        hideBoost
      />

      {/* Terms Modal */}
      <TermsModal
        show={showTermsModal}
        acceptedTerms={acceptedTerms}
        onAcceptChange={setAcceptedTerms}
        onClose={() => setShowTermsModal(false)}
        onContinue={() => {
          if (acceptedTerms) {
            setShowTermsModal(false);
            fileUpload.hiddenFileInputRef.current?.click();
          }
        }}
      />

      {/* Interaction Modal */}
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
        viewingModeIsDragging={viewingPostHook.viewingModeIsDragging}
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

