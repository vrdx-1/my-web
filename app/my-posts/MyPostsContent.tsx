'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Shared Components
import { PostFeed } from '@/components/PostFeed';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { TabNavigation } from '@/components/TabNavigation';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import {
  EditNameModal,
  EditPhoneModal,
  ProfileSection,
} from '@/app/(main)/profile/edit-profile/EditProfileSections';
import { useEditProfilePage } from '@/app/(main)/profile/edit-profile/useEditProfilePage';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { InteractionModal } from '@/components/modals/InteractionModal';

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
import { useInteractionModal } from '@/hooks/useInteractionModal';
import { useBackHandler } from '@/components/BackHandlerContext';

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export function MyPostsContent() {
  const router = useRouter();
  const [tab, setTab] = useState('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [sessionState, setSessionState] = useState<any>(undefined);
  const hasFetchedRef = useRef(false);
  const postsRef = useRef<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSessionState(session));
  }, []);

  const postListData = usePostListData({
    type: 'my-posts',
    session: sessionState,
    tab,
    loadAll: true, // โหลดโพสต์ของฉันทั้งหมดครั้งเดียว
  });
  postsRef.current = postListData.posts;

  const {
    username,
    phone,
    avatarUrl,
    profileLoading,
    isEditingName,
    isEditingPhone,
    editingUsername,
    editingPhone,
    setEditingUsername,
    setEditingPhone,
    uploadAvatar,
    handleEditNameClick,
    handleEditPhoneClick,
    handleCancelPhoneEdit,
    handleCloseNameModal,
    handleSaveUsername,
    handleSavePhone,
  } = useEditProfilePage();

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const headerScroll = useHeaderScroll();
  const interactionModalHook = useInteractionModal();

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
  });

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
    if (sessionState !== undefined && postListData.session !== undefined && !hasFetchedRef.current) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
      hasFetchedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, postListData.session]);

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

  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore && postListData.session !== undefined) {
      postListData.fetchPosts(false, postListData.page);
    }
  }, [postListData.page, postListData.session]);

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
    interactionModalShow: interactionModalHook.interactionModal.show,
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
  });

  const { addBackStep } = useBackHandler();

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

  const fetchInteractions = useCallback(
    async (type: 'likes' | 'saves', postId: string) => {
      await interactionModalHook.fetchInteractions(type, postId, postsRef.current);
    },
    [interactionModalHook],
  );

  return (
    <main
      style={{
        ...LAYOUT_CONSTANTS.MAIN_CONTAINER,
        ...((isEditingName || isEditingPhone) && {
          overflow: 'hidden',
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }),
      }}
      onTouchMove={
        isEditingName || isEditingPhone
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
      onWheel={
        isEditingName || isEditingPhone
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      {/* Overlay when editing name or phone - คลุมทั้งจอและล็อกพื้นหลัง ไม่ให้แตะหรือสกรอล์ส่วนอื่นขณะเปลี่ยนชื่อ/กรอกเบอร์โทร */}
      {(isEditingName || isEditingPhone) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999,
            pointerEvents: 'auto',
            touchAction: 'none',
            overscrollBehavior: 'contain',
            overflow: 'hidden',
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}

      <EditNameModal
        isOpen={isEditingName}
        editingUsername={editingUsername}
        setEditingUsername={setEditingUsername}
        onClose={handleCloseNameModal}
        onSave={handleSaveUsername}
      />

      <EditPhoneModal
        isOpen={isEditingPhone}
        editingPhone={editingPhone}
        setEditingPhone={setEditingPhone}
        onCancel={handleCancelPhoneEdit}
        onSave={handleSavePhone}
      />

      <PageHeader title="ໂພສຂອງຂ້ອຍ" centerTitle onBack={handleBack} />
      {profileLoading ? (
        <div
          className="my-posts-profile-skeleton"
          style={{ padding: '20px', borderBottom: '1px solid #6b6b6b' }}
          aria-hidden
        >
          <style>{`
            @keyframes my-posts-profile-skeleton-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                backgroundSize: '200% 100%',
                animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, paddingTop: 10 }}>
              <div
                style={{
                  height: 18,
                  width: '70%',
                  maxWidth: 160,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  height: 44,
                  width: '100%',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <ProfileSection
          avatarUrl={avatarUrl}
          username={username}
          phone={phone}
          onAvatarChange={uploadAvatar}
          onEditNameClick={handleEditNameClick}
          onEditPhoneClick={handleEditPhoneClick}
        />
      )}
      <div style={{ position: 'sticky', top: 48, zIndex: 99, background: '#ffffff', backgroundColor: '#ffffff' }}>
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
            } else {
              setTab(v);
              setTabRefreshing(true);
            }
          }}
          loadingTab={tabRefreshing ? tab : null}
        />
      </div>

      {postListData.posts.length === 0 && postListData.loadingMore ? (
        <FeedSkeleton />
      ) : (
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
        loadingMore={postListData.hasMore ? postListData.loadingMore : false}
        hasMore={postListData.hasMore}
        onLoadMore={() => postListData.setPage((p) => p + 1)}
        hideBoost={tab === 'sold'}
      />
      )}

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
    </main>
  );
}
