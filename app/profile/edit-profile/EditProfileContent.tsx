'use client'
import { useCallback, useEffect } from 'react';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { TabNavigation } from '@/components/TabNavigation';
import { PageHeader } from '@/components/PageHeader';
import {
  EditNameModal,
  EditPhoneModal,
  PhoneCharWarningPopup,
  ProfileSection,
} from './EditProfileSections';
import { EditProfilePostOverlays } from './EditProfilePostOverlays';
import { useEditProfilePage } from './useEditProfilePage';
import { useBackHandler } from '@/components/BackHandlerContext';

import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

// Removed duplicate dynamic imports - using from PostFeedModals component

export function EditProfileContent() {
 const {
   username,
   phone,
   avatarUrl,
   isEditingName,
   isEditingPhone,
   editingUsername,
   editingPhone,
   setEditingUsername,
   setEditingPhone,
   showPhoneCharWarning,
   setShowPhoneCharWarning,
   tab,
   setTab,
   tabRefreshing,
   setTabRefreshing,
   justLikedPosts,
   justSavedPosts,
   menu,
   fullScreenViewer,
   viewingPostHook,
   headerScroll,
   interactionModalHook,
   postListData,
   lastPostElementRef,
   handlers,
   toggleLike,
   toggleSave,
   fetchInteractions,
   uploadAvatar,
   handleEditNameClick,
   handleEditPhoneClick,
   handleCancelPhoneEdit,
   handleCloseNameModal,
   handleSaveUsername,
   handleSavePhone,
 } = useEditProfilePage();

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

 return (
 <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>

 {/* Header */}
 <PageHeader title="ໂປຣໄຟລ໌" centerTitle />

 {/* Overlay when editing name or phone - คลุมทั้งจอ ส่วนอื่น dim */}
 {(isEditingName || isEditingPhone) && (
 <div
 role="button"
 tabIndex={0}
 style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, cursor: 'pointer' }}
 aria-label="ปิด"
 />
 )}

 {/* Modal ชื่อเท่านั้น - ชัดเจนเฉพาะชื่อ (ไม่บันทึก = ใช้ค่าเดิม) */}
 <EditNameModal
   isOpen={isEditingName}
   editingUsername={editingUsername}
   setEditingUsername={setEditingUsername}
   onClose={handleCloseNameModal}
   onSave={handleSaveUsername}
 />

 {/* Modal เบอร์เท่านั้น - ชัดเจนเฉพาะเบอร์ (ไม่บันทึก = ใช้ค่าเดิม) */}
 <EditPhoneModal
   isOpen={isEditingPhone}
   editingPhone={editingPhone}
   setEditingPhone={setEditingPhone}
   onCancel={handleCancelPhoneEdit}
   onSave={handleSavePhone}
   showPhoneCharWarning={showPhoneCharWarning}
   setShowPhoneCharWarning={setShowPhoneCharWarning}
 />

 {/* Profile Section */}
 <ProfileSection
   avatarUrl={avatarUrl}
   username={username}
   phone={phone}
   onAvatarChange={uploadAvatar}
   onEditNameClick={handleEditNameClick}
   onEditPhoneClick={handleEditPhoneClick}
 />

 <div style={{ height: '8px', background: '#d1d5db' }}></div>

 {/* Tabs Section */}
 <TabNavigation
   tabs={[
     { value: 'recommend', label: 'ພ້ອມຂາຍ' },
     { value: 'sold', label: 'ຂາຍແລ້ວ' },
   ]}
   activeTab={tab}
   // v มาจาก TabNavigation ที่เป็น string แต่เราจำกัดให้เป็น 'recommend' | 'sold'
   onTabChange={(v) => {
     if (v === tab) {
       setTabRefreshing(true);
       postListData.setPage(0);
       postListData.setHasMore(true);
       postListData.fetchPosts(true);
       return;
     }
     setTabRefreshing(true);
     setTab(v as 'recommend' | 'sold');
   }}
   loadingTab={tabRefreshing ? tab : null}
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
   onImpression={handlers.handleImpression}
   onLike={toggleLike}
   onSave={toggleSave}
   onShare={handlers.handleShare}
  onViewLikes={(postId) => fetchInteractions('likes', postId)}
  onViewSaves={(postId) => fetchInteractions('saves', postId)}
   onTogglePostStatus={handlers.handleTogglePostStatus}
   onDeletePost={handlers.handleDeletePost}
   onReport={() => {}}
   onSetActiveMenu={menu.setActiveMenu}
   onSetMenuAnimating={menu.setIsMenuAnimating}
  // สำหรับหน้าโปรไฟล์ ซ่อนอนิเมชั่นโหลดด้านล่างฟีด (ไม่ให้หมุนค้าง)
  loadingMore={false}
  hasMore={false}
   hideBoost={tab === 'sold'}
 />

<EditProfilePostOverlays
  interactionModalHook={interactionModalHook}
  posts={postListData.posts}
  fetchInteractions={fetchInteractions}
  viewingPostHook={viewingPostHook}
  headerScroll={headerScroll}
  fullScreenViewer={fullScreenViewer}
  session={postListData.session}
  handlers={handlers}
/>
 </main>
 );
}

