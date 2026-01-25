'use client'

import { useState, useEffect, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { PostFeedModals } from '@/components/PostFeedModals';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Avatar } from '@/components/Avatar';
import { TermsModal } from '@/components/modals/TermsModal';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { AppHeader } from '@/components/AppHeader';

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

// Shared Utils
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

function SoldPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState('');
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Use home data hook for user profile and session management
  const homeData = useHomeData('');

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

  // Initialize data when search term changes
  useEffect(() => {
    if (homeData.session !== undefined) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
    }
  }, [searchTerm]);

  // Load more when page changes
  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore) {
      postListData.fetchPosts(false);
    }
  }, [postListData.page]);

  // Handle shared post from URL
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId && postListData.posts.length > 0) {
      const sharedPost = postListData.posts.find(p => p.id === postId);
      if (sharedPost) {
        viewingPostHook.setInitialImageIndex(0);
        viewingPostHook.setIsViewingModeOpen(false);
        viewingPostHook.setViewingPost(sharedPost);
        router.replace(window.location.pathname, { scroll: false });
      }
    } else if (postId && postListData.posts.length === 0) {
      const checkPost = async () => {
        const { data } = await supabase.from('cars').select('*, profiles!cars_user_id_fkey(*)').eq('id', postId).single();
        if (data) {
          viewingPostHook.setInitialImageIndex(0);
          viewingPostHook.setIsViewingModeOpen(false);
          viewingPostHook.setViewingPost(data);
          router.replace(window.location.pathname, { scroll: false });
        }
      };
      checkPost();
    }
  }, [searchParams, postListData.posts, router, viewingPostHook]);

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

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <input type="file" ref={fileUpload.hiddenFileInputRef} multiple accept="image/*" onChange={fileUpload.handleFileChange} style={{ display: 'none' }} />

      <AppHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreatePostClick={() => fileUpload.handleCreatePostClick(homeData.session, showTermsModal, setShowTermsModal)}
        onNotificationClick={() => router.push('/notification')}
        userProfile={homeData.userProfile}
        session={homeData.session}
        isHeaderVisible={headerScroll.isHeaderVisible}
        onTabChange={handleLogoClick}
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
        onViewingPostClose={() => {
          viewingPostHook.setIsViewingModeOpen(false);
          headerScroll.setIsHeaderVisible(true);
          setTimeout(() => {
            viewingPostHook.setViewingPost(null);
            window.scrollTo(0, viewingPostHook.savedScrollPosition);
          }, 300);
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
    </main>
  );
}

export default function SoldPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <SoldPageContent />
    </Suspense>
  );
}
