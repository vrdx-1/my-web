'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';

// Shared Components
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PostCard } from '@/components/PostCard';
import { PostFeedModals } from '@/components/PostFeedModals';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

// Shared Hooks
import { useViewingPost } from '@/hooks/useViewingPost';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useMenu } from '@/hooks/useMenu';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { usePostModals } from '@/hooks/usePostModals';

// Shared Utils
import { getPrimaryGuestToken } from '@/utils/postUtils';

export default function NotificationDetail() {
 const router = useRouter();
 const { id } = useParams();

 // --- States หลัก ---
 const [post, setPost] = useState<any>(null);
 const [session, setSession] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
 const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
 const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
 const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
 const [reportingPost, setReportingPost] = useState<any | null>(null);
 const [reportReason, setReportReason] = useState('');
 const [isSubmittingReport, setIsSubmittingReport] = useState(false);

 // Use shared hooks
 const menu = useMenu();
 const viewingPostHook = useViewingPost();
 const fullScreenViewer = useFullScreenViewer();
 const headerScroll = useHeaderScroll();
 const interactionModalHook = useInteractionModal();

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
   supabase.auth.getSession().then(({ data: { session } }) => {
     setSession(session);
     if (session) {
       fetchLikedStatus(session.user.id, true);
       fetchSavedStatus(session.user.id, true);
     } else {
       const token = getPrimaryGuestToken();
       fetchLikedStatus(token, false);
       fetchSavedStatus(token, false);
     }
   });
 }, []);

 const fetchLikedStatus = useCallback(async (userIdOrToken: string, isUser: boolean) => {
   const table = isUser ? 'post_likes' : 'post_likes_guest';
   const column = isUser ? 'user_id' : 'guest_token';
   const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
   if (data) {
     const likedMap: { [key: string]: boolean } = {};
     data.forEach(item => likedMap[item.post_id] = true);
     setLikedPosts(likedMap);
   }
 }, []);

 const fetchSavedStatus = useCallback(async (userIdOrToken: string, isUser: boolean) => {
   const table = isUser ? 'post_saves' : 'post_saves_guest';
   const column = isUser ? 'user_id' : 'guest_token';
   const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
   if (data) {
     const savedMap: { [key: string]: boolean } = {};
     data.forEach(item => savedMap[item.post_id] = true);
     setSavedPosts(savedMap);
   }
 }, []);

 const fetchPostDetail = useCallback(async () => {
   setLoading(true);
   const { data } = await supabase
     .from('cars')
     .select('*, profiles!cars_user_id_fkey(*)')
     .eq('id', id)
     .single();
   if (data) {
     setPost(data);
     // Increment views
     try {
       // Try to use RPC function if available (same pattern as useViewingPost.ts)
       if (supabase && typeof supabase.rpc === 'function') {
         const { error } = await supabase.rpc('increment_views', { post_id: id });
         if (error) {
           // Fallback: update views directly if RPC fails
           await supabase.from('cars').update({ views: (data.views || 0) + 1 }).eq('id', id);
         }
       } else {
         // RPC is not available, update directly
         await supabase.from('cars').update({ views: (data.views || 0) + 1 }).eq('id', id);
       }
     } catch (error) {
       // Fallback: update views directly if any error occurs
       console.error('Error incrementing views:', error);
       try {
         await supabase.from('cars').update({ views: (data.views || 0) + 1 }).eq('id', id);
       } catch (updateError) {
         console.error('Error updating views:', updateError);
       }
     }
   }
   setLoading(false);
 }, [id]);

 useEffect(() => {
   if (id) {
     fetchPostDetail();
   }
 }, [id, fetchPostDetail]);

 // Use shared post interactions hook
 const { toggleLike, toggleSave } = usePostInteractions({
   session,
   posts: post ? [post] : [],
   setPosts: (updater) => {
     if (typeof updater === 'function') {
       setPost((prevPost: any) => {
         const updatedPosts = updater(prevPost ? [prevPost] : []);
         return updatedPosts[0] || prevPost;
       });
     } else {
       setPost(updater[0] || post);
     }
   },
   likedPosts,
   savedPosts,
   setLikedPosts,
   setSavedPosts,
   setJustLikedPosts,
   setJustSavedPosts,
 });

 // Use shared post feed handlers
 const handlers = usePostFeedHandlers({
   session,
   posts: post ? [post] : [],
   setPosts: (updater) => {
     if (typeof updater === 'function') {
       setPost((prevPost: any) => {
         const updatedPosts = updater(prevPost ? [prevPost] : []);
         return updatedPosts[0] || prevPost;
       });
     } else {
       setPost(updater[0] || post);
     }
   },
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

 const fetchInteractions = useCallback(async (type: 'likes' | 'saves', postId: string) => {
   await interactionModalHook.fetchInteractions(type, postId, post ? [post] : []);
 }, [interactionModalHook, post]);

 const handleViewLikes = useCallback((postId: string) => {
   fetchInteractions('likes', postId);
 }, [fetchInteractions]);

 const handleViewSaves = useCallback((postId: string) => {
   fetchInteractions('saves', postId);
 }, [fetchInteractions]);

 if (loading || !post) return (
   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
     <LoadingSpinner />
   </div>
 );

 return (
   <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
     {/* 1. Header */}
     <div style={{ 
       padding: '15px', 
       borderBottom: '1px solid #f0f0f0', 
       display: 'flex', 
       alignItems: 'center', 
       justifyContent: 'center', 
       position: 'sticky',
       top: 0,
       background: '#fff',
       zIndex: 100,
       flexShrink: 0
     }}>
       <button 
         onClick={() => router.back()} 
         style={{ 
           background: 'none', 
           border: 'none', 
           cursor: 'pointer', 
           display: 'flex', 
           alignItems: 'center', 
           justifyContent: 'center', 
           padding: '8px', 
           touchAction: 'manipulation',
           position: 'absolute',
           left: '15px'
         }}
       >
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <polyline points="15 18 9 12 15 6"></polyline>
         </svg>
       </button>
       <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>ລາຍລະອຽດໂພສ</h1>
     </div>

     {/* 2. PostCard - Using shared component */}
     {post && (
       <PostCard
         post={post}
         index={0}
         isLastElement={false}
         session={session}
         likedPosts={likedPosts}
         savedPosts={savedPosts}
         justLikedPosts={justLikedPosts}
         justSavedPosts={justSavedPosts}
         activeMenuState={menu.activeMenuState}
         isMenuAnimating={menu.isMenuAnimating}
         menuButtonRefs={menu.menuButtonRefs}
         onViewPost={handlers.handleViewPost}
         onLike={toggleLike}
         onSave={toggleSave}
         onShare={handlers.handleShare}
         onViewLikes={handleViewLikes}
         onViewSaves={handleViewSaves}
         onTogglePostStatus={handlers.handleTogglePostStatus}
         onDeletePost={handlers.handleDeletePost}
         onReport={handlers.handleReport}
         onSetActiveMenu={menu.setActiveMenu}
         onSetMenuAnimating={menu.setIsMenuAnimating}
       />
     )}

     {/* Modals - Using shared components */}
     <InteractionModal
       show={interactionModalHook.interactionModal.show}
       type={interactionModalHook.interactionModal.type}
       postId={interactionModalHook.interactionModal.postId}
       posts={post ? [post] : []}
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

     {/* PostFeedModals - Using shared components */}
     <PostFeedModals
       viewingPost={viewingPostHook.viewingPost}
       session={session}
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
  </main>
 );
}
