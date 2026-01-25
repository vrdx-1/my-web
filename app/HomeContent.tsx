'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { PostFeedModals } from '@/components/PostFeedModals';
import { AppHeader } from '@/components/AppHeader';

// Modal Components (Static - used frequently)
import { TermsModal } from '@/components/modals/TermsModal';
import { InteractionModal } from '@/components/modals/InteractionModal';

// Shared Hooks
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useViewingPost } from '@/hooks/useViewingPost';
import { useHomeData } from '@/hooks/useHomeData';
// @ts-ignore - File exists, TypeScript language server cache issue
import { useFileUpload } from '@/hooks/useFileUpload';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useMenu } from '@/hooks/useMenu';
import { usePostModals } from '@/hooks/usePostModals';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export function HomeContent() {
 const router = useRouter();
const searchParams = useSearchParams(); 
 const [searchTerm, setSearchTerm] = useState('');
const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
 
 // Use home data hook
 const homeData = useHomeData(searchTerm);
 
 // Use viewing post hook
 const viewingPostHook = useViewingPost();
 // Use menu hook
 const menu = useMenu();
 
 // Use header scroll hook
 const headerScroll = useHeaderScroll();

 // Use fullScreen viewer hook
 const fullScreenViewer = useFullScreenViewer();

 // Use interaction modal hook
 const interactionModalHook = useInteractionModal();

 // --- State สำหรับ Pop-up เงื่อนไข ---
 const [showTermsModal, setShowTermsModal] = useState(false);
 const [acceptedTerms, setAcceptedTerms] = useState(false);

 // Use file upload hook
 const fileUpload = useFileUpload();

 // Use shared infinite scroll hook
 const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
   loadingMore: homeData.loadingMore,
   hasMore: homeData.hasMore,
   onLoadMore: () => homeData.setPage(prevPage => prevPage + 1),
   threshold: 0.3, // เพิ่ม threshold เพื่อให้ trigger ช้ากว่าเดิม (ลดการกระตุก)
 });

 const [reportingPost, setReportingPost] = useState<any | null>(null);
 const [reportReason, setReportReason] = useState('');
 const [isSubmittingReport, setIsSubmittingReport] = useState(false);


useEffect(() => {
router.prefetch('/profile');
}, [router]);

// Track processed postId to avoid re-running when posts change
const processedPostIdRef = useRef<string | null>(null);

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

useEffect(() => {
const postId = searchParams.get('post');
if (!postId) {
  processedPostIdRef.current = null;
  return;
}

// Skip if we already processed this postId
if (processedPostIdRef.current === postId) {
  return;
}

// Try to find post in current posts
if (homeData.posts.length > 0) {
  const sharedPost = homeData.posts.find(p => p.id === postId);
  if (sharedPost) {
    processedPostIdRef.current = postId;
    viewingPostHook.setInitialImageIndex(0);
    viewingPostHook.setIsViewingModeOpen(false);
    viewingPostHook.setViewingPost(sharedPost);
    router.replace(window.location.pathname, { scroll: false });
    return;
  }
}

// If post not found in current posts, fetch it
const checkPost = async () => {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('id, caption, province, images, status, created_at, is_boosted, is_hidden, user_id, views, likes, saves, profiles!cars_user_id_fkey(username, avatar_url, phone, last_seen)')
      .eq('id', postId)
      .single();
    if (error) {
      console.error('Error fetching post:', error);
      return;
    }
    if (data) {
      processedPostIdRef.current = postId;
      viewingPostHook.setInitialImageIndex(0);
      viewingPostHook.setIsViewingModeOpen(false);
      viewingPostHook.setViewingPost(data);
      router.replace(window.location.pathname, { scroll: false });
    }
  } catch (err) {
    console.error('Error in checkPost:', err);
  }
};

// Only fetch if posts are loaded (to avoid duplicate fetches)
if (homeData.posts.length > 0 || !homeData.loadingMore) {
  checkPost();
}
}, [searchParams, router, viewingPostHook, homeData.posts, homeData.loadingMore]);


 const fetchInteractions = useCallback(async (type: 'likes' | 'saves', postId: string) => {
   await interactionModalHook.fetchInteractions(type, postId, homeData.posts);
 }, [interactionModalHook]); // Remove homeData.posts from dependencies - posts parameter is not actually used in the hook



 const handleLogoClick = useCallback(() => {
   homeData.setPage(0);
   homeData.fetchPosts(true);
   window.scrollTo({ top: 0, behavior: 'smooth' });
 }, [homeData]);

 // Use shared post interactions hook
 const { toggleLike, toggleSave } = usePostInteractions({
   session: homeData.session,
   posts: homeData.posts,
   setPosts: homeData.setPosts,
   likedPosts: homeData.likedPosts,
   savedPosts: homeData.savedPosts,
   setLikedPosts: homeData.setLikedPosts,
   setSavedPosts: homeData.setSavedPosts,
   setJustLikedPosts,
   setJustSavedPosts,
 });

 // Use shared post feed handlers
 const handlers = usePostFeedHandlers({
   session: homeData.session,
   posts: homeData.posts,
   setPosts: homeData.setPosts,
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

 return (
 <main style={{ width: '100%', margin: '0', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
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
   posts={homeData.posts}
   session={homeData.session}
   likedPosts={homeData.likedPosts}
   savedPosts={homeData.savedPosts}
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
   loadingMore={homeData.loadingMore}
 />

 <InteractionModal
   show={interactionModalHook.interactionModal.show}
   type={interactionModalHook.interactionModal.type}
   postId={interactionModalHook.interactionModal.postId}
   posts={homeData.posts}
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

 {/* Loading spinner is handled by PostFeed component */}

 <TermsModal
   show={showTermsModal}
   acceptedTerms={acceptedTerms}
   onClose={() => setShowTermsModal(false)}
   onAcceptChange={setAcceptedTerms}
   onContinue={() => {
     if (acceptedTerms) {
       setShowTermsModal(false);
       fileUpload.hiddenFileInputRef.current?.click();
     }
   }}
 />

 <PostFeedModals
   viewingPost={viewingPostHook.viewingPost}
   session={homeData.session}
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
   onViewingPostTouchEnd={(e: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(e, headerScroll.setIsHeaderVisible)}
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
       fullScreenViewer.setIsPhotoMenuAnimating(true);
       setTimeout(() => {
         fullScreenViewer.setActivePhotoMenu(null);
         fullScreenViewer.setIsPhotoMenuAnimating(false);
       }, 300);
     }
   }}
   onFullScreenTouchStart={fullScreenViewer.fullScreenOnTouchStart}
   onFullScreenTouchMove={fullScreenViewer.fullScreenOnTouchMove}
   onFullScreenTouchEnd={fullScreenViewer.fullScreenOnTouchEnd}
   onFullScreenClick={fullScreenViewer.fullScreenOnClick}
   onFullScreenDownload={fullScreenViewer.downloadImage}
   onFullScreenImageIndexChange={fullScreenViewer.setCurrentImgIndex}
   onFullScreenPhotoMenuToggle={(index: number) => {
     if (fullScreenViewer.activePhotoMenu === index) {
       fullScreenViewer.setIsPhotoMenuAnimating(true);
       setTimeout(() => {
         fullScreenViewer.setActivePhotoMenu(null);
         fullScreenViewer.setIsPhotoMenuAnimating(false);
       }, 300);
     } else {
       fullScreenViewer.setActivePhotoMenu(index);
       fullScreenViewer.setIsPhotoMenuAnimating(true);
       requestAnimationFrame(() => {
         requestAnimationFrame(() => {
           fullScreenViewer.setIsPhotoMenuAnimating(false);
         });
       });
     }
   }}
   onFullScreenDownloadBottomSheetClose={() => {
     fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
     setTimeout(() => {
       fullScreenViewer.setShowDownloadBottomSheet(false);
       fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
     }, 300);
   }}
   onFullScreenDownloadBottomSheetDownload={() => {
     fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
     setTimeout(() => {
       fullScreenViewer.setShowDownloadBottomSheet(false);
       fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
       if (fullScreenViewer.fullScreenImages) {
         fullScreenViewer.downloadImage(fullScreenViewer.fullScreenImages[fullScreenViewer.currentImgIndex]);
       }
     }, 300);
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
