'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Shared Components
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PostFeed } from '@/components/PostFeed';
import { TabNavigation } from '@/components/TabNavigation';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PhotoGrid } from '@/components/PhotoGrid';
import { PageHeader } from '@/components/PageHeader';

// Shared Hooks
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';

// Shared Utils
import { formatTime, getOnlineStatus, isPostOwner } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

// Removed duplicate dynamic imports - using from PostFeedModals component

export function EditProfileContent() {
 const router = useRouter();
 
 // Profile States
 const [username, setUsername] = useState('');
 const [phone, setPhone] = useState('');
 const [avatarUrl, setAvatarUrl] = useState('');
 const [userId, setUserId] = useState<string | null>(null);
 const [isEditingName, setIsEditingName] = useState(false);
 const [isEditingPhone, setIsEditingPhone] = useState(false);
 const [uploading, setUploading] = useState(false);

 // Feed States
 const [tab, setTab] = useState('recommend');
 const [session, setSession] = useState<any>(null);
 const [justLikedPosts, setJustLikedPosts] = useState<{[key: string]: boolean}>({});
 const [justSavedPosts, setJustSavedPosts] = useState<{[key: string]: boolean}>({});

 // Use shared hooks
 const menu = useMenu();
 const fullScreenViewer = useFullScreenViewer();
 const viewingPostHook = useViewingPost();
 const headerScroll = useHeaderScroll();

 // Use post list data hook for my-posts
 const postListData = usePostListData({
   type: 'my-posts',
   userIdOrToken: userId || undefined,
   session,
   tab,
 });

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

 useEffect(() => {
 const checkUser = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (session) {
 setSession(session);
 setUserId(session.user.id);
 fetchProfile(session.user.id);
 } else {
 router.push('/register');
 }
 };
 checkUser();
 }, []);

 // Initialize data when tab changes
 useEffect(() => {
   if (userId && session) {
     postListData.setPage(0);
     postListData.setHasMore(true);
     postListData.fetchPosts(true);
   }
 }, [tab, userId, session]);

 // Load more when page changes
 useEffect(() => {
   if (postListData.page > 0 && !postListData.loadingMore && userId && session) {
     postListData.fetchPosts(false);
   }
 }, [postListData.page, userId, session]);

 const fetchProfile = async (uid: string) => {
 // Optimize: Select เฉพาะ fields ที่จำเป็น
 const { data } = await supabase
   .from('profiles')
   .select('username, avatar_url, phone, last_seen')
   .eq('id', uid)
   .single();
 if (data) {
 setUsername(data.username || '');
 setAvatarUrl(data.avatar_url || '');
 setPhone(data.phone || '');
 }
 };

 // Removed duplicate fetchMyPosts - using from usePostListData hook

 // Removed duplicate fetchSavedStatus and fetchLikedStatus - using from usePostListData hook

 // Removed duplicate functions - using from shared utils

 const uploadAvatar = async (event: any) => {
 try {
 setUploading(true);
 const file = event.target.files[0];
 if (!file) return;
 const filePath = `avatars/${userId}-${Date.now()}`;
 await supabase.storage.from('car-images').upload(filePath, file);
 const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(filePath);
 
 await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
 setAvatarUrl(publicUrl);
 } finally { setUploading(false); }
 };

 const saveUsername = async () => {
 const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
 if (!error) {
 setIsEditingName(false);
 alert("ບັນທຶກຊື່ສຳເລັດ!");
 }
 };

 const savePhone = async () => {
 const { error } = await supabase.from('profiles').update({ phone }).eq('id', userId);
 if (!error) {
 setIsEditingPhone(false);
 alert("ບັນທຶກເບີໂທສຳເລັດ!");
 }
 };

 // Removed duplicate formatTime - using from utils/postUtils

 // Use shared post feed handlers
 const handlers = usePostFeedHandlers({
   session: postListData.session,
   posts: postListData.posts,
   setPosts: postListData.setPosts,
   viewingPostHook,
   headerScroll,
   menu,
 });

 // Removed duplicate downloadImage, onTouchStart, onTouchEnd - using from useFullScreenViewer hook

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

 {/* Header */}
 <PageHeader title="ແກ້ໄຂໂປຣໄຟລ໌" />

 {/* Profile Section */}
 <div style={{ padding: '20px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
 <div style={{ position: 'relative', width: '90px', height: '90px' }}>
 <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5', border: '1px solid #ddd' }}>
 {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>👤</div>}
 </div>
 <label htmlFor="avatar-up" style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%', padding: '7px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
 <input id="avatar-up" type="file" hidden onChange={uploadAvatar} accept="image/*" />
 </label>
 </div>
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
 {isEditingName ? (
 <>
 <input value={username} onChange={e => setUsername(e.target.value)} autoFocus style={{ fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #1877f2', outline: 'none', width: '60%', padding: '4px 0' }} />
 <button onClick={saveUsername} style={{ padding: '4px 12px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>ບັນທຶກ</button>
 </>
 ) : (
 <>
 <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1c1e21' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</h2>
 <button onClick={() => setIsEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
 </button>
 </>
 )}
 </div>
 </div>
 
 <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
 <input 
 type="text" 
 value={phone} 
 onChange={e => setPhone(e.target.value)} 
 onFocus={() => setIsEditingPhone(true)}
 placeholder="ເບີ WhatsApp (20XXXXXXXX)" 
 style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', fontSize: '15px' }} 
 />
 {isEditingPhone && (
 <button onClick={savePhone} style={{ padding: '0 15px', background: '#1877f2', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>ບັນທຶກ</button>
 )}
 </div>
 </div>

 <div style={{ height: '8px', background: '#f0f2f5' }}></div>

 {/* Tabs Section */}
 <TabNavigation
   tabs={[
     { value: 'recommend', label: 'ພ້ອມຂາຍ' },
     { value: 'sold', label: 'ຂາຍແລ້ວ' },
   ]}
   activeTab={tab}
   onTabChange={setTab}
   className="sticky top-[45px] bg-white z-[90]"
 />

 {/* Posts Feed */}
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
   onViewLikes={() => {}}
   onViewSaves={() => {}}
   onTogglePostStatus={handlers.handleTogglePostStatus}
   onDeletePost={handlers.handleDeletePost}
   onReport={() => {}}
   onSetActiveMenu={menu.setActiveMenu}
   onSetMenuAnimating={menu.setIsMenuAnimating}
   loadingMore={postListData.loadingMore}
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
 />
 </main>
 );
}

