'use client'

import React, { Suspense, lazy } from 'react';
import { ReportModal } from './modals/ReportModal';

// Dynamic Imports for heavy modals (lazy loaded)
const ViewingPostModal = lazy(() =>
  import('@/components/modals/ViewingPostModal').then((m) => ({ default: m.ViewingPostModal }))
) as React.LazyExoticComponent<React.ComponentType<any>>;
const FullScreenImageViewer = lazy(() =>
  import('@/components/modals/FullScreenImageViewer').then((m) => ({ default: m.FullScreenImageViewer }))
) as React.LazyExoticComponent<React.ComponentType<any>>;

interface PostFeedModalsProps {
  // Viewing Post Modal
  viewingPost: any | null;
  session: any;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  savedScrollPosition: number;
  initialImageIndex?: number;
  onViewingPostClose: () => void;
  onViewingPostTouchStart: (e: React.TouchEvent) => void;
  onViewingPostTouchMove: (e: React.TouchEvent) => void;
  onViewingPostTouchEnd: (e: React.TouchEvent) => void;
  onViewingPostImageClick: (images: string[], index: number) => void;

  // Full Screen Image Viewer
  fullScreenImages: string[] | null;
  currentImgIndex: number;
  fullScreenDragOffset: number;
  fullScreenEntranceOffset: number;
  fullScreenVerticalDragOffset: number;
  fullScreenIsDragging: boolean;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  activePhotoMenu: number | null;
  isPhotoMenuAnimating: boolean;
  showDownloadBottomSheet: boolean;
  isDownloadBottomSheetAnimating: boolean;
  showImageForDownload: string | null;
  onFullScreenClose: () => void;
  onFullScreenTouchStart: (e: React.TouchEvent) => void;
  onFullScreenTouchMove: (e: React.TouchEvent) => void;
  onFullScreenTouchEnd: (e: React.TouchEvent) => void;
  onFullScreenClick: (e: React.MouseEvent) => void;
  onFullScreenDownload: (url: string) => void;
  onFullScreenImageIndexChange: (index: number) => void;
  onFullScreenPhotoMenuToggle: (index: number) => void;
  onFullScreenDownloadBottomSheetClose: () => void;
  onFullScreenDownloadBottomSheetDownload: () => void;
  onFullScreenImageForDownloadClose: () => void;

  // Report Modal
  reportingPost?: any | null;
  reportReason?: string;
  isSubmittingReport?: boolean;
  onReportClose?: () => void;
  onReportReasonChange?: (reason: string) => void;
  onReportSubmit?: () => void;
}

/**
 * PostFeedModals Component
 * Centralized component for rendering all modals used in post feeds
 */
export const PostFeedModals = React.memo<PostFeedModalsProps>(({
  viewingPost,
  session,
  isViewingModeOpen,
  viewingModeDragOffset,
  savedScrollPosition,
  initialImageIndex = 0,
  onViewingPostClose,
  onViewingPostTouchStart,
  onViewingPostTouchMove,
  onViewingPostTouchEnd,
  onViewingPostImageClick,
  fullScreenImages,
  currentImgIndex,
  fullScreenDragOffset,
  fullScreenEntranceOffset,
  fullScreenVerticalDragOffset,
  fullScreenIsDragging,
  fullScreenTransitionDuration,
  fullScreenShowDetails,
  fullScreenZoomScale,
  fullScreenZoomOrigin,
  activePhotoMenu,
  isPhotoMenuAnimating,
  showDownloadBottomSheet,
  isDownloadBottomSheetAnimating,
  showImageForDownload,
  onFullScreenClose,
  onFullScreenTouchStart,
  onFullScreenTouchMove,
  onFullScreenTouchEnd,
  onFullScreenClick,
  onFullScreenDownload,
  onFullScreenImageIndexChange,
  onFullScreenPhotoMenuToggle,
  onFullScreenDownloadBottomSheetClose,
  onFullScreenDownloadBottomSheetDownload,
  onFullScreenImageForDownloadClose,
  reportingPost,
  reportReason = '',
  isSubmittingReport = false,
  onReportClose,
  onReportReasonChange,
  onReportSubmit,
}) => {
  return (
    <>
      {/* Viewing Post Modal */}
      {viewingPost && (
        <Suspense fallback={null}>
          <ViewingPostModal
            viewingPost={viewingPost}
            session={session}
            isViewingModeOpen={isViewingModeOpen}
            viewingModeDragOffset={viewingModeDragOffset}
            savedScrollPosition={savedScrollPosition}
            initialImageIndex={initialImageIndex}
            onClose={onViewingPostClose}
            onTouchStart={onViewingPostTouchStart}
            onTouchMove={onViewingPostTouchMove}
            onTouchEnd={onViewingPostTouchEnd}
            onImageClick={onViewingPostImageClick}
          />
        </Suspense>
      )}

      {/* Full Screen Image Viewer */}
      {fullScreenImages && (
        <Suspense fallback={null}>
          <FullScreenImageViewer
            images={fullScreenImages}
            currentImgIndex={currentImgIndex}
            fullScreenDragOffset={fullScreenDragOffset}
            fullScreenEntranceOffset={fullScreenEntranceOffset}
            fullScreenTransitionDuration={fullScreenTransitionDuration}
            fullScreenShowDetails={fullScreenShowDetails}
            onClose={onFullScreenClose}
            onTouchStart={onFullScreenTouchStart}
            onTouchMove={onFullScreenTouchMove}
            onTouchEnd={onFullScreenTouchEnd}
            onClick={onFullScreenClick}
          />
        </Suspense>
      )}

      {/* Report Modal */}
      {reportingPost && onReportClose && onReportReasonChange && onReportSubmit && (
        <ReportModal
          reportingPost={reportingPost}
          reportReason={reportReason}
          isSubmittingReport={isSubmittingReport}
          onClose={onReportClose}
          onReasonChange={onReportReasonChange}
          onSubmit={onReportSubmit}
        />
      )}
    </>
  );
});

PostFeedModals.displayName = 'PostFeedModals';
