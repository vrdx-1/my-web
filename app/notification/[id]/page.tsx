'use client';

import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PostCard } from '@/components/PostCard';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { BoostAdDetailsPopup } from '@/components/modals/BoostAdDetailsPopup';
import { useNotificationDetail } from './useNotificationDetail';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const BOOST_BUTTON_STYLE = {
  display: 'inline-flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  background: '#1877f2',
  border: '1px solid #1877f2',
  borderRadius: '999px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#fff',
  cursor: 'pointer' as const,
  boxShadow: '0 2px 10px rgba(24, 119, 242, 0.20)',
};

export default function NotificationDetail() {
  const { id } = useParams();
  const {
    post,
    session,
    loading,
    likedPosts,
    savedPosts,
    justLikedPosts,
    justSavedPosts,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    boostInfo,
    showBoostDetails,
    setShowBoostDetails,
    isBoostExpired,
    fetchBoostInfo,
    menu,
    viewingPostHook,
    fullScreenViewer,
    headerScroll,
    interactionModalHook,
    handlers,
    toggleLike,
    toggleSave,
    handleTogglePostStatus,
    fetchInteractions,
  } = useNotificationDetail(id as string | undefined);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <PageHeader title="ລາຍລະອຽດໂພສ" centerTitle />

      {!post ? (
        <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
          <EmptyState message="ບໍ່ມີຂໍ້ມູນ" variant="minimal" />
        </div>
      ) : (
        <>
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
            onImpression={handlers.handleImpression}
            onLike={toggleLike}
            onSave={toggleSave}
            onShare={handlers.handleShare}
            onViewLikes={(postId) => fetchInteractions('likes', postId)}
            onViewSaves={(postId) => fetchInteractions('saves', postId)}
            onTogglePostStatus={handleTogglePostStatus}
            onDeletePost={handlers.handleDeletePost}
            onReport={handlers.handleReport}
            onSetActiveMenu={menu.setActiveMenu}
            onSetMenuAnimating={menu.setIsMenuAnimating}
            hideBoost={post.status === 'sold'}
          />

          {boostInfo && !isBoostExpired && (
            <div style={{ padding: '12px 15px 0', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={async () => {
                  await fetchBoostInfo();
                  setShowBoostDetails(true);
                }}
                style={BOOST_BUTTON_STYLE}
              >
                ສະຖານະໂຄສະນາ
              </button>
            </div>
          )}
        </>
      )}

      <BoostAdDetailsPopup
        show={showBoostDetails}
        status={boostInfo?.status ?? null}
        expiresAt={boostInfo?.expiresAt ?? null}
        justSubmitted={false}
        submitError={null}
        overlay="dim"
        confirmOnly
        zIndex={2000}
        onClose={() => setShowBoostDetails(false)}
      />

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
        onFetchInteractions={fetchInteractions}
      />

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        viewingModeIsDragging={viewingPostHook.viewingModeIsDragging}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible)}
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
          if (fullScreenViewer.activePhotoMenu != null) {
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
            requestAnimationFrame(() => requestAnimationFrame(() => fullScreenViewer.setIsPhotoMenuAnimating(false)));
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

      {handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}
      {handlers.showDeleteConfirm && (
        <DeleteConfirmModal onConfirm={handlers.handleConfirmDelete} onCancel={handlers.handleCancelDelete} />
      )}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
    </main>
  );
}
