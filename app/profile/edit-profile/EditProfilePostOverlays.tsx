import { memo } from 'react';
import { InteractionModal } from '@/components/modals/InteractionModal';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

type EditProfilePostOverlaysProps = {
  // Interaction modal props
  interactionModalHook: {
    interactionModal: {
      show: boolean;
      type: 'likes' | 'saves' | null;
      postId: string | null;
    };
    interactionUsers: any[];
    interactionLoading: boolean;
    interactionSheetMode: string | null;
    isInteractionModalAnimating: boolean;
    startY: number;
    currentY: number;
    closeModal: () => void;
    onSheetTouchStart: (e: React.TouchEvent) => void;
    onSheetTouchMove: (e: React.TouchEvent) => void;
    onSheetTouchEnd: (e: React.TouchEvent) => void;
  };
  posts: any[];
  fetchInteractions: (type: 'likes' | 'saves', postId: string) => Promise<void>;

  // Viewing post / full screen viewer props
  viewingPostHook: any;
  headerScroll: { setIsHeaderVisible: (visible: boolean) => void };
  fullScreenViewer: any;
  session: any;

  // Handler flags and callbacks
  handlers: {
    showReportSuccess?: boolean;
    setShowReportSuccess?: (value: boolean) => void;
    showDeleteConfirm?: boolean;
    handleConfirmDelete?: () => void;
    handleCancelDelete?: () => void;
    showDeleteSuccess?: boolean;
    setShowDeleteSuccess?: (value: boolean) => void;
  };
};

const EditProfilePostOverlaysComponent = ({
  interactionModalHook,
  posts,
  fetchInteractions,
  viewingPostHook,
  headerScroll,
  fullScreenViewer,
  session,
  handlers,
}: EditProfilePostOverlaysProps) => (
  <>
    <InteractionModal
      show={interactionModalHook.interactionModal.show}
      type={interactionModalHook.interactionModal.type}
      postId={interactionModalHook.interactionModal.postId}
      posts={posts}
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
      session={session}
      isViewingModeOpen={viewingPostHook.isViewingModeOpen}
      viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
      viewingModeIsDragging={viewingPostHook.viewingModeIsDragging}
      savedScrollPosition={viewingPostHook.savedScrollPosition}
      initialImageIndex={viewingPostHook.initialImageIndex}
      onViewingPostClose={() => {
        viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible);
      }}
      onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
      onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
      onViewingPostTouchEnd={(e: React.TouchEvent) =>
        viewingPostHook.handleViewingModeTouchEnd(e, () => {})
      }
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
      <SuccessPopup
        message="ລົບໂພສສຳເລັດ"
        onClose={() => handlers.setShowDeleteSuccess?.(false)}
      />
    )}
  </>
);

export const EditProfilePostOverlays = memo(EditProfilePostOverlaysComponent);

