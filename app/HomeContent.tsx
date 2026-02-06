'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { PostFeedModals } from '@/components/PostFeedModals';
import { HomeHeader } from '@/components/home/HomeHeader';
import { SearchScreen } from '@/components/SearchScreen';

// Modal Components (Static - used frequently)
import { TermsModal } from '@/components/modals/TermsModal';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

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
import { LAO_FONT } from '@/utils/constants';
import { PageSpinner } from '@/components/LoadingSpinner';

export function HomeContent() {
 const router = useRouter();
const searchParams = useSearchParams(); 
 const pathname = usePathname();
 const [searchTerm, setSearchTerm] = useState('');
const [isSearchScreenOpen, setIsSearchScreenOpen] = useState(false);
const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
const [tabRefreshing, setTabRefreshing] = useState(false);
const [hasInitialFetchCompleted, setHasInitialFetchCompleted] = useState(false);
const initialFetchStartedRef = useRef(false);

// Pull-to-refresh state
const [pullDistance, setPullDistance] = useState(0);
const [isPulling, setIsPulling] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
const pullStartYRef = useRef<number | null>(null);
 
 // Use home data hook
 const homeData = useHomeData(searchTerm);

 const [unreadCount, setUnreadCount] = useState<number>(0);

 const fetchUnreadCount = useCallback(async () => {
   const userId = homeData.session?.user?.id;
   if (!userId) {
     setUnreadCount(0);
     return;
   }
   const { data, error } = await supabase.rpc('get_unread_notifications_count', { p_user_id: String(userId) });
   if (!error) {
     const n = typeof data === 'number' ? data : Number(data);
     setUnreadCount(Number.isFinite(n) ? n : 0);
   }
 }, [homeData.session]);

 useEffect(() => {
   fetchUnreadCount();
 }, [fetchUnreadCount]);

 // Re-fetch when returning to this tab/page
 useEffect(() => {
   if (pathname !== '/') return;
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
 
 // Use viewing post hook
 const viewingPostHook = useViewingPost();
 // Use menu hook
 const menu = useMenu();
 
// Use header scroll hook (ซ่อน header ตอนเลื่อนลง และแสดงเมื่อเลื่อนขึ้น)
const headerScroll = useHeaderScroll({ loadingMore: homeData.loadingMore });

 // Use fullScreen viewer hook
 const fullScreenViewer = useFullScreenViewer();

 // Use interaction modal hook
 const interactionModalHook = useInteractionModal();

 // --- State สำหรับ Pop-up เงื่อนไข ---
 const [showTermsModal, setShowTermsModal] = useState(false);
 const [acceptedTerms, setAcceptedTerms] = useState(false);
 
 // --- State สำหรับ Pop-up ลงทะเบียนสำเร็จ ---
 const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

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

// ตรวจสอบ flag สำหรับแสดง popup ลงทะเบียนสำเร็จ
useEffect(() => {
  const showRegistrationSuccessFlag = localStorage.getItem('show_registration_success');
  if (showRegistrationSuccessFlag === 'true') {
    setShowRegistrationSuccess(true);
    localStorage.removeItem('show_registration_success');
  }
}, []);

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
      .select('id, caption, province, images, status, created_at, is_boosted, is_hidden, user_id, views, likes, saves, shares, profiles!cars_user_id_fkey(username, avatar_url, phone, last_seen)')
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

 useEffect(() => {
   if (!homeData.loadingMore) setTabRefreshing(false);
 }, [homeData.loadingMore]);

// Hide empty state until first fetch finishes (avoid "no items" while loading)
useEffect(() => {
  if (!initialFetchStartedRef.current && homeData.loadingMore) {
    initialFetchStartedRef.current = true;
  }
  if (initialFetchStartedRef.current && !homeData.loadingMore) {
    setHasInitialFetchCompleted(true);
  }
}, [homeData.loadingMore]);

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

 const handleTouchStart = (e: any) => {
   if (typeof window === 'undefined') return;
   if (window.scrollY === 0 && !isRefreshing && !homeData.loadingMore) {
     if (e.touches && e.touches.length > 0) {
       pullStartYRef.current = e.touches[0].clientY;
       setIsPulling(true);
       setPullDistance(0);
     }
   } else {
     pullStartYRef.current = null;
     setIsPulling(false);
     setPullDistance(0);
   }
 };

 const handleTouchMove = (e: any) => {
   if (!isPulling || pullStartYRef.current === null) return;
   if (typeof window !== 'undefined' && window.scrollY > 0) {
     pullStartYRef.current = null;
     setIsPulling(false);
     setPullDistance(0);
     return;
   }
   if (!e.touches || e.touches.length === 0) return;
   const currentY = e.touches[0].clientY;
   const diff = currentY - pullStartYRef.current;
   if (diff <= 0) {
     setPullDistance(0);
     return;
   }
   const maxPull = 120;
   setPullDistance(Math.min(diff, maxPull));
 };

 const handleTouchEnd = async () => {
   if (!isPulling) {
     setPullDistance(0);
     return;
   }
   const threshold = 70;
   const shouldRefresh = pullDistance >= threshold;
   setIsPulling(false);
   setPullDistance(0);
   if (shouldRefresh && !isRefreshing) {
     setIsRefreshing(true);
     try {
       await homeData.refreshData();
       if (typeof window !== 'undefined') {
         window.scrollTo({ top: 0 });
       }
     } finally {
       setIsRefreshing(false);
     }
   }
 };

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
 <main
   style={{ width: '100%', margin: '0', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}
   onTouchStart={handleTouchStart}
   onTouchMove={handleTouchMove}
   onTouchEnd={handleTouchEnd}
 >
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
   controlSize={40}
   iconSize={22}
   onTabRefresh={() => {
     setTabRefreshing(true);
     handleLogoClick();
   }}
   loadingTab={tabRefreshing ? 'recommend' : null}
 />

 <SearchScreen
   isOpen={isSearchScreenOpen}
   searchTerm={searchTerm}
   onSearchChange={setSearchTerm}
   onClose={() => setIsSearchScreenOpen(false)}
 />

 <div style={LAYOUT_CONSTANTS.HEADER_SPACER}></div>

<div
  style={{
    height: isRefreshing ? 50 : pullDistance > 0 ? Math.min(pullDistance, 80) : 0,
    transition: isPulling ? 'none' : 'height 0.2s ease',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  }}
>
  {(isRefreshing || pullDistance > 20) && <PageSpinner />}
</div>

 {homeData.posts.length === 0 && (!hasInitialFetchCompleted || homeData.loadingMore) ? (
   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
     <PageSpinner />
   </div>
 ) : (
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
    loadingMore={homeData.loadingMore}
    hasMore={homeData.hasMore}
   />
 )}

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
     viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible);
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

 {/* ป๊อบอัพแสดงผลสำเร็จการลงทะเบียน */}
 {showRegistrationSuccess && (
   <SuccessPopup message="ສ້າງບັນຊີສຳເລັດ" onClose={() => setShowRegistrationSuccess(false)} />
 )}
 </main>
 );
}
