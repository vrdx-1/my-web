'use client';

import React, { memo } from 'react';
import { PostFeedModals } from '@/components/PostFeedModals';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

interface ViewingPostHookLike {
  viewingPost: unknown;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  savedScrollPosition: number;
  initialImageIndex: number;
  closeViewingMode: (setHeaderVisible: (visible: boolean) => void) => void;
  handleViewingModeTouchStart: (event: React.TouchEvent) => void;
  handleViewingModeTouchMove: (event: React.TouchEvent) => void;
  handleViewingModeTouchEnd: (
    event: React.TouchEvent,
    onClose: () => void,
  ) => void;
}

interface FullScreenViewerLike {
  fullScreenImages: string[] | null;
  setFullScreenImages: (images: string[] | null) => void;
  currentImgIndex: number;
  setCurrentImgIndex: (index: number) => void;
  fullScreenDragOffset: number;
  fullScreenEntranceOffset: number;
  fullScreenVerticalDragOffset: number;
  fullScreenIsDragging: boolean;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  activePhotoMenu: number | null;
  setActivePhotoMenu: (index: number | null) => void;
  isPhotoMenuAnimating: boolean;
  showDownloadBottomSheet: boolean;
  setShowDownloadBottomSheet: (visible: boolean) => void;
  isDownloadBottomSheetAnimating: boolean;
  setIsDownloadBottomSheetAnimating: (animating: boolean) => void;
  showImageForDownload: string | null;
  setShowImageForDownload: (image: string | null) => void;
  fullScreenOnTouchStart: (event: React.TouchEvent) => void;
  fullScreenOnTouchMove: (event: React.TouchEvent) => void;
  fullScreenOnTouchEnd: (event: React.TouchEvent) => void;
  fullScreenOnClick: () => void;
  downloadImage: (imageUrl: string) => void;
}

interface HeaderScrollLike {
  setIsHeaderVisible: (visible: boolean) => void;
}

interface PostFeedHandlersLike {
  handleSubmitReport: () => void;
  showReportSuccess: boolean;
  setShowReportSuccess?: (visible: boolean) => void;
  showDeleteConfirm: boolean;
  handleConfirmDelete: () => void;
  handleCancelDelete: () => void;
  showDeleteSuccess: boolean;
  setShowDeleteSuccess?: (visible: boolean) => void;
  showRepostSuccess: boolean;
  setShowRepostSuccess?: (visible: boolean) => void;
}

export interface HomePageModalsProps {
  effectiveSession: unknown;
  fullScreenViewer: FullScreenViewerLike;
  handlers: PostFeedHandlersLike;
  headerScroll: HeaderScrollLike;
  isSoldTabNoSearch: boolean;
  isSubmittingReport: boolean;
  reportReason: string;
  reportingPost: unknown;
  setReportReason: (reason: string) => void;
  setReportingPost: (post: unknown) => void;
  soldReportSubmitRef: React.MutableRefObject<(() => void) | null>;
  viewingPostHook: ViewingPostHookLike;
}

function HomePageModalsBase(props: HomePageModalsProps) {
  const {
    effectiveSession,
    fullScreenViewer,
    handlers,
    headerScroll,
    isSoldTabNoSearch,
    isSubmittingReport,
    reportReason,
    reportingPost,
    setReportReason,
    setReportingPost,
    soldReportSubmitRef,
    viewingPostHook,
  } = props;

  return (
    <>
      {(viewingPostHook.viewingPost ||
        fullScreenViewer.fullScreenImages ||
        reportingPost) && (
        <PostFeedModals
          viewingPost={viewingPostHook.viewingPost}
          session={effectiveSession}
          isViewingModeOpen={viewingPostHook.isViewingModeOpen}
          viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
          savedScrollPosition={viewingPostHook.savedScrollPosition}
          initialImageIndex={viewingPostHook.initialImageIndex}
          onViewingPostClose={() =>
            viewingPostHook.closeViewingMode(headerScroll.setIsHeaderVisible)
          }
          onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
          onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
          onViewingPostTouchEnd={(event: React.TouchEvent) =>
            viewingPostHook.handleViewingModeTouchEnd(event, () => {})
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
              setTimeout(() => fullScreenViewer.setActivePhotoMenu(null), 300);
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
          onFullScreenImageForDownloadClose={() =>
            fullScreenViewer.setShowImageForDownload(null)
          }
          reportingPost={reportingPost}
          reportReason={reportReason}
          isSubmittingReport={isSubmittingReport}
          onReportClose={() => setReportingPost(null)}
          onReportReasonChange={setReportReason}
          onReportSubmit={
            isSoldTabNoSearch
              ? () => soldReportSubmitRef.current?.()
              : handlers.handleSubmitReport
          }
        />
      )}

      {!isSoldTabNoSearch && handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}
      {!isSoldTabNoSearch && handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
        />
      )}
      {!isSoldTabNoSearch && handlers.showDeleteSuccess && (
        <SuccessPopup
          message="ລົບໂພສສຳເລັດ"
          onClose={() => handlers.setShowDeleteSuccess?.(false)}
        />
      )}
      {!isSoldTabNoSearch && handlers.showRepostSuccess && (
        <SuccessPopup
          message="ໂພສໃໝ່ສຳເລັດ"
          onClose={() => handlers.setShowRepostSuccess?.(false)}
        />
      )}
    </>
  );
}

export const HomePageModals = memo(HomePageModalsBase);