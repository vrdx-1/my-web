'use client'

import dynamic from 'next/dynamic';
import { PostFeed } from '@/components/PostFeed';
import { HomeHeader } from '@/components/home/HomeHeader';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { LAO_FONT } from '@/utils/constants';
import { PageSpinner } from '@/components/LoadingSpinner';
import { useHomeContent } from '@/hooks/useHomeContent';

// Lazy load heavy modals
const PostFeedModals = dynamic(() => import('@/components/PostFeedModals').then(m => ({ default: m.PostFeedModals })), { ssr: false });
const SearchScreen = dynamic(() => import('@/components/SearchScreen').then(m => ({ default: m.SearchScreen })), { ssr: false });
const InteractionModal = dynamic(() => import('@/components/modals/InteractionModal').then(m => ({ default: m.InteractionModal })), { ssr: false });
const ReportSuccessPopup = dynamic(() => import('@/components/modals/ReportSuccessPopup').then(m => ({ default: m.ReportSuccessPopup })), { ssr: false });
const SuccessPopup = dynamic(() => import('@/components/modals/SuccessPopup').then(m => ({ default: m.SuccessPopup })), { ssr: false });
const DeleteConfirmModal = dynamic(() => import('@/components/modals/DeleteConfirmModal').then(m => ({ default: m.DeleteConfirmModal })), { ssr: false });

export function HomeContent() {
 const {
   searchTerm,
   setSearchTerm,
   isSearchScreenOpen,
   setIsSearchScreenOpen,
   homeData,
   unreadCount,
   hasInitialFetchCompleted,
   handlers,
   fetchInteractions,
   postFeedProps,
   interactionModalProps,
   postFeedModalsProps,
   popups,
   tabRefreshing,
   fileUpload,
 } = useHomeContent();

 return (
 <main
   style={{ width: '100%', margin: '0', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}
 >
 <input type="file" ref={fileUpload.hiddenFileInputRef} multiple accept="image/*" onChange={fileUpload.handleFileChange} style={{ display: 'none' }} />

  <HomeHeader
    searchTerm={searchTerm}
    onSearchChange={setSearchTerm}
    onCreatePostClick={handlers.handleCreatePostClick}
    onNotificationClick={handlers.handleNotificationClick}
    unreadCount={unreadCount}
    userProfile={homeData.userProfile}
    session={homeData.session}
    isHeaderVisible={true}
    onTabChange={handlers.handleLogoClick}
    onSearchClick={handlers.handleSearchClick}
    controlSize={40}
    iconSize={22}
    onTabRefresh={handlers.handleTabRefresh}
    loadingTab={tabRefreshing ? 'recommend' : null}
  />

 {isSearchScreenOpen && (
   <SearchScreen
     isOpen={isSearchScreenOpen}
     searchTerm={searchTerm}
     onSearchChange={setSearchTerm}
     onClose={handlers.handleSearchClose}
   />
 )}

 <div style={LAYOUT_CONSTANTS.HEADER_SPACER}></div>

{/* pull-to-refresh ถูกปิดการใช้งานแล้ว บนหน้า Home */}
 {homeData.posts.length === 0 && (!hasInitialFetchCompleted || homeData.loadingMore) ? (
   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
     <PageSpinner />
   </div>
 ) : (
   <PostFeed {...postFeedProps} />
 )}

 <InteractionModal
   {...interactionModalProps}
   posts={homeData.posts}
   onFetchInteractions={fetchInteractions}
 />

 {/* Loading spinner is handled by PostFeed component */}

 <PostFeedModals
   session={homeData.session}
   {...postFeedModalsProps}
 />

 {/* Popups */}
 {popups.showReportSuccess && (
   <ReportSuccessPopup onClose={popups.onCloseReportSuccess} />
 )}
 {popups.showDeleteConfirm && (
   <DeleteConfirmModal
     onConfirm={popups.onConfirmDelete}
     onCancel={popups.onCancelDelete}
   />
 )}
 {popups.showDeleteSuccess && (
   <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={popups.onCloseDeleteSuccess} />
 )}
 {popups.showRegistrationSuccess && (
   <SuccessPopup message="ສ້າງບັນຊີສຳເລັດ" onClose={popups.onCloseRegistrationSuccess} />
 )}
 </main>
 );
}
