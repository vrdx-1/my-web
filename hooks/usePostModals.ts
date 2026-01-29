'use client'

import { useEffect } from 'react';

interface UsePostModalsProps {
  viewingPost: any | null;
  isViewingModeOpen: boolean;
  setIsViewingModeOpen: (open: boolean) => void;
  setViewingModeDragOffset: (offset: number) => void;
  setViewingModeIsDragging: (dragging: boolean) => void;
  initialImageIndex: number;
  savedScrollPosition: number;
  fullScreenImages: string[] | null;
  setFullScreenDragOffset: (offset: number) => void;
  setFullScreenVerticalDragOffset: (offset: number) => void;
  setFullScreenZoomScale: (scale: number | ((prev: number) => number)) => void;
  setFullScreenZoomOrigin: (origin: string) => void;
  setFullScreenIsDragging: (dragging: boolean) => void;
  setFullScreenTransitionDuration: (duration: number) => void;
  setFullScreenShowDetails: (show: boolean | ((prev: boolean) => boolean)) => void;
  interactionModalShow: boolean;
  setIsHeaderVisible: (visible: boolean) => void;
}

/**
 * usePostModals Hook
 * Manages side effects for viewing post, fullscreen viewer, and interaction modals
 */
export function usePostModals({
  viewingPost,
  isViewingModeOpen,
  setIsViewingModeOpen,
  setViewingModeDragOffset,
  setViewingModeIsDragging,
  initialImageIndex,
  savedScrollPosition,
  fullScreenImages,
  setFullScreenDragOffset,
  setFullScreenVerticalDragOffset,
  setFullScreenZoomScale,
  setFullScreenZoomOrigin,
  setFullScreenIsDragging,
  setFullScreenTransitionDuration,
  setFullScreenShowDetails,
  interactionModalShow,
  setIsHeaderVisible,
}: UsePostModalsProps) {
  // Handle viewing post modal effects
  useEffect(() => {
    if (!viewingPost) {
      setIsViewingModeOpen(false);
      setViewingModeDragOffset(0);
      setViewingModeIsDragging(false);
      document.body.style.overflow = '';
      window.scrollTo(0, savedScrollPosition);
    } else if (viewingPost.images) {
      document.body.style.overflow = 'hidden';
      setViewingModeDragOffset(0);
      setViewingModeIsDragging(false);
      setIsViewingModeOpen(true);
      setTimeout(() => {
        const imageElement = document.getElementById(`viewing-image-${initialImageIndex}`);
        const container = document.getElementById('viewing-mode-container');
        if (imageElement && container) {
          const headerHeight = 60;
          const imageTop = imageElement.offsetTop - headerHeight;
          container.scrollTop = imageTop;
        }
      }, 10);
    }
    return () => {
      if (!viewingPost) {
        document.body.style.overflow = '';
      }
    };
  }, [viewingPost, setIsViewingModeOpen, setViewingModeDragOffset, setViewingModeIsDragging, initialImageIndex, savedScrollPosition]);

  // Handle fullscreen viewer effects
  useEffect(() => {
    if (fullScreenImages) {
      setFullScreenDragOffset(0);
      setFullScreenVerticalDragOffset(0);
      setFullScreenZoomScale(1);
      setFullScreenZoomOrigin('50% 50%');
      setFullScreenIsDragging(false);
      setFullScreenTransitionDuration(0);
      setFullScreenShowDetails(true);
    }
  }, [fullScreenImages, setFullScreenDragOffset, setFullScreenVerticalDragOffset, setFullScreenZoomScale, setFullScreenZoomOrigin, setFullScreenIsDragging, setFullScreenTransitionDuration, setFullScreenShowDetails]);

  // Handle interaction modal effects
  useEffect(() => {
    if (interactionModalShow) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [interactionModalShow]);
}
