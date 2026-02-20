'use client'

import { useMemo } from 'react';
import { createPostFeedModalsProps } from '@/utils/postFeedModalsHelpers';

/**
 * Custom hook สำหรับสร้างและ memoize PostFeedModals props
 * แยก logic เพื่อลดความซับซ้อนของ HomeContent และ optimize performance
 */
export function usePostFeedModalsProps({
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
}: {
  viewingPostHook: {
    viewingPost: any | null;
    isViewingModeOpen: boolean;
    viewingModeDragOffset: number;
    savedScrollPosition: number;
    initialImageIndex: number;
  };
  fullScreenViewer: {
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
  };
  headerScroll?: { setIsHeaderVisible: (visible: boolean) => void; isHeaderVisible: boolean };
  posts: any[];
  reportingPost: any | null;
  setReportingPost: (post: any | null) => void;
  reportReason: string;
  setReportReason: (reason: string) => void;
  isSubmittingReport: boolean;
  setIsSubmittingReport: (submitting: boolean) => void;
  handleSubmitReport: () => void;
}) {
  // Optimize dependencies โดยใช้ key objects เพื่อลด re-renders
  const viewingPostKey = useMemo(() => ({
    id: viewingPostHook.viewingPost?.id,
    isOpen: viewingPostHook.isViewingModeOpen,
    dragOffset: viewingPostHook.viewingModeDragOffset,
    scrollPos: viewingPostHook.savedScrollPosition,
    imgIndex: viewingPostHook.initialImageIndex,
  }), [
    viewingPostHook.viewingPost?.id,
    viewingPostHook.isViewingModeOpen,
    viewingPostHook.viewingModeDragOffset,
    viewingPostHook.savedScrollPosition,
    viewingPostHook.initialImageIndex,
  ]);

  const fullScreenKey = useMemo(() => ({
    images: fullScreenViewer.fullScreenImages,
    currentIndex: fullScreenViewer.currentImgIndex,
    dragOffset: fullScreenViewer.fullScreenDragOffset,
    entranceOffset: fullScreenViewer.fullScreenEntranceOffset,
    verticalDragOffset: fullScreenViewer.fullScreenVerticalDragOffset,
    isDragging: fullScreenViewer.fullScreenIsDragging,
    transitionDuration: fullScreenViewer.fullScreenTransitionDuration,
    showDetails: fullScreenViewer.fullScreenShowDetails,
    zoomScale: fullScreenViewer.fullScreenZoomScale,
    zoomOrigin: fullScreenViewer.fullScreenZoomOrigin,
    activeMenu: fullScreenViewer.activePhotoMenu,
    menuAnimating: fullScreenViewer.isPhotoMenuAnimating,
    downloadSheet: fullScreenViewer.showDownloadBottomSheet,
    downloadAnimating: fullScreenViewer.isDownloadBottomSheetAnimating,
    imageForDownload: fullScreenViewer.showImageForDownload,
  }), [
    fullScreenViewer.fullScreenImages,
    fullScreenViewer.currentImgIndex,
    fullScreenViewer.fullScreenDragOffset,
    fullScreenViewer.fullScreenEntranceOffset,
    fullScreenViewer.fullScreenVerticalDragOffset,
    fullScreenViewer.fullScreenIsDragging,
    fullScreenViewer.fullScreenTransitionDuration,
    fullScreenViewer.fullScreenShowDetails,
    fullScreenViewer.fullScreenZoomScale,
    fullScreenViewer.fullScreenZoomOrigin,
    fullScreenViewer.activePhotoMenu,
    fullScreenViewer.isPhotoMenuAnimating,
    fullScreenViewer.showDownloadBottomSheet,
    fullScreenViewer.isDownloadBottomSheetAnimating,
    fullScreenViewer.showImageForDownload,
  ]);

  // Memoize PostFeedModals props to prevent unnecessary re-renders
  const postFeedModalsProps = useMemo(() => createPostFeedModalsProps({
    viewingPostHook,
    fullScreenViewer,
    headerScroll: headerScroll ?? {
      setIsHeaderVisible: (_visible: boolean) => {},
      isHeaderVisible: true,
    },
    posts,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
    handleSubmitReport,
  }), [
    viewingPostKey,
    fullScreenKey,
    headerScroll,
    posts,
    reportingPost,
    reportReason,
    isSubmittingReport,
    handleSubmitReport,
  ]);

  return postFeedModalsProps;
}
