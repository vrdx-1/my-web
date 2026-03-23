'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { usePostDetail } from './usePostDetail';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

export default function PostDetail() {
  const router = useRouter();
  const { id } = useParams();

  /** โหลดแพ็กเก็จ /home ล่วงหน้า — กดกลับแล้วโฮมขึ้นเร็ว ไม่นิ่งจอขาว */
  useEffect(() => {
    router.prefetch('/home');
  }, [router]);

  const handleBack = useCallback(() => {
    if (typeof window === 'undefined') {
      router.back();
      return;
    }
    const before = window.location.href;
    router.back();
    window.setTimeout(() => {
      if (window.location.href === before) router.push('/');
    }, 150);
  }, [router]);

  const {
    post,
    session,
    loading,
    savedPosts,
    justSavedPosts,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    menu,
    viewingPostHook,
    fullScreenViewer,
    headerScroll,
    handlers,
    toggleSave,
    handleTogglePostStatus,
  } = usePostDetail(id as string | undefined);

  return (
    <>
      <FeedWithPreload showSkeleton={loading} skeletonCount={1}>
        <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
          <PageHeader title="ລາຍລະອຽດໂພສ" centerTitle onBack={handleBack} />

          {!post ? (
            <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
              <EmptyState message="ບໍ່ມີຂໍ້ມູນ" variant="minimal" />
            </div>
          ) : (
            <PostCard
              post={post}
              index={0}
              isLastElement={false}
              session={session}
              savedPosts={savedPosts}
              justSavedPosts={justSavedPosts}
              activeMenuState={menu.activeMenuState}
              isMenuAnimating={menu.isMenuAnimating}
              menuButtonRefs={menu.menuButtonRefs}
              onViewPost={handlers.handleViewPost}
              onSave={toggleSave}
              onShare={handlers.handleShare}
              onTogglePostStatus={handleTogglePostStatus}
              onDeletePost={handlers.handleDeletePost}
              onReport={handlers.handleReport}
              onSetActiveMenu={menu.setActiveMenu}
              onSetMenuAnimating={menu.setIsMenuAnimating}
              hideBoost={post.status === 'sold'}
            />
          )}
        </main>
      </FeedWithPreload>

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
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
    </>
  );
}
