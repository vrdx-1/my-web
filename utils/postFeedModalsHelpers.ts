/**
 * Helper functions for creating PostFeedModals props
 * Reduces boilerplate code in components
 */

interface CreatePostFeedModalsPropsOptions {
  viewingPostHook: any; // ReturnType<typeof useViewingPost>
  fullScreenViewer: any; // ReturnType<typeof useFullScreenViewer>
  headerScroll: { setIsHeaderVisible: (visible: boolean) => void; isHeaderVisible: boolean };
  posts: any[];
  reportingPost: any | null;
  setReportingPost: (post: any | null) => void;
  reportReason: string;
  setReportReason: (reason: string) => void;
  isSubmittingReport: boolean;
  setIsSubmittingReport: (submitting: boolean) => void;
  handleSubmitReport: () => void;
}

/**
 * Creates props for PostFeedModals component
 * Handles all the complex prop mapping and inline handlers
 */
export function createPostFeedModalsProps({
  viewingPostHook,
  fullScreenViewer,
  headerScroll,
  posts,
  reportingPost,
  setReportingPost,
  reportReason,
  setReportReason,
  isSubmittingReport,
  setIsSubmittingReport,
  handleSubmitReport,
}: CreatePostFeedModalsPropsOptions) {
  return {
    // Viewing Post Modal props
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    viewingModeDragOffset: viewingPostHook.viewingModeDragOffset,
    savedScrollPosition: viewingPostHook.savedScrollPosition,
    initialImageIndex: viewingPostHook.initialImageIndex,
    onViewingPostClose: () => {
      // ถ้าโพสต์ที่กำลังดูอยู่เป็นโพสต์แรกใน feed ให้แสดง header เสมอ
      const isFirstPost = posts.length > 0 && viewingPostHook.viewingPost?.id === posts[0]?.id;
      viewingPostHook.closeViewingMode();
      if (isFirstPost) {
        headerScroll.setIsHeaderVisible(true);
      }
    },
    onViewingPostTouchStart: viewingPostHook.handleViewingModeTouchStart,
    onViewingPostTouchMove: viewingPostHook.handleViewingModeTouchMove,
    onViewingPostTouchEnd: (e: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(e, headerScroll.setIsHeaderVisible),
    onViewingPostImageClick: (images: string[], index: number) => {
      fullScreenViewer.setFullScreenImages(images);
      fullScreenViewer.setCurrentImgIndex(index);
    },

    // Full Screen Image Viewer props
    fullScreenImages: fullScreenViewer.fullScreenImages,
    currentImgIndex: fullScreenViewer.currentImgIndex,
    fullScreenDragOffset: fullScreenViewer.fullScreenDragOffset,
    fullScreenEntranceOffset: fullScreenViewer.fullScreenEntranceOffset,
    fullScreenVerticalDragOffset: fullScreenViewer.fullScreenVerticalDragOffset,
    fullScreenIsDragging: fullScreenViewer.fullScreenIsDragging,
    fullScreenTransitionDuration: fullScreenViewer.fullScreenTransitionDuration,
    fullScreenShowDetails: fullScreenViewer.fullScreenShowDetails,
    fullScreenZoomScale: fullScreenViewer.fullScreenZoomScale,
    fullScreenZoomOrigin: fullScreenViewer.fullScreenZoomOrigin,
    activePhotoMenu: fullScreenViewer.activePhotoMenu,
    isPhotoMenuAnimating: fullScreenViewer.isPhotoMenuAnimating,
    showDownloadBottomSheet: fullScreenViewer.showDownloadBottomSheet,
    isDownloadBottomSheetAnimating: fullScreenViewer.isDownloadBottomSheetAnimating,
    showImageForDownload: fullScreenViewer.showImageForDownload,
    onFullScreenClose: () => {
      fullScreenViewer.setFullScreenImages(null);
      if (fullScreenViewer.activePhotoMenu !== null) {
        fullScreenViewer.setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          fullScreenViewer.setActivePhotoMenu(null);
          fullScreenViewer.setIsPhotoMenuAnimating(false);
        }, 300);
      }
    },
    onFullScreenTouchStart: fullScreenViewer.fullScreenOnTouchStart,
    onFullScreenTouchMove: fullScreenViewer.fullScreenOnTouchMove,
    onFullScreenTouchEnd: fullScreenViewer.fullScreenOnTouchEnd,
    onFullScreenClick: fullScreenViewer.fullScreenOnClick,
    onFullScreenDownload: fullScreenViewer.downloadImage,
    onFullScreenImageIndexChange: fullScreenViewer.setCurrentImgIndex,
    onFullScreenPhotoMenuToggle: (index: number) => {
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
    },
    onFullScreenDownloadBottomSheetClose: () => {
      fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
      setTimeout(() => {
        fullScreenViewer.setShowDownloadBottomSheet(false);
        fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
      }, 300);
    },
    onFullScreenDownloadBottomSheetDownload: () => {
      fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
      setTimeout(() => {
        fullScreenViewer.setShowDownloadBottomSheet(false);
        fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
        if (fullScreenViewer.fullScreenImages) {
          fullScreenViewer.downloadImage(fullScreenViewer.fullScreenImages[fullScreenViewer.currentImgIndex]);
        }
      }, 300);
    },
    onFullScreenImageForDownloadClose: () => fullScreenViewer.setShowImageForDownload(null),

    // Report Modal props
    reportingPost,
    reportReason,
    isSubmittingReport,
    onReportClose: () => setReportingPost(null),
    onReportReasonChange: setReportReason,
    onReportSubmit: handleSubmitReport,
  };
}
