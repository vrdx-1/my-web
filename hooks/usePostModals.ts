'use client'

import { useEffect } from 'react';

interface UsePostModalsProps {
  viewingPost: any | null;
  isViewingModeOpen: boolean;
  setIsViewingModeOpen: (open: boolean) => void;
  setViewingModeDragOffset: (offset: number) => void;
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
  // Ensure body scroll is restored if this hook unmounts.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle viewing post modal: reset state when closed; scroll to image when open (body lock is done by ViewingPostModal)
  useEffect(() => {
    if (!viewingPost) {
      setIsViewingModeOpen(false);
      setViewingModeDragOffset(0);
      document.body.style.overflow = '';
      document.body.style.scrollbarWidth = '';
      document.body.style.msOverflowStyle = '';
      document.body.removeAttribute('data-viewing-mode');
      window.scrollTo(0, savedScrollPosition);
    } else if (viewingPost.images) {
      setViewingModeDragOffset(0);
      setIsViewingModeOpen(true);
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = document.getElementById('viewing-mode-container');
          const imageElement = document.getElementById(`viewing-image-${initialImageIndex}`);
          if (container && imageElement) {
            const imageTop = imageElement.offsetTop;
            const imageHeight = imageElement.offsetHeight;
            const containerHeight = container.clientHeight;
            container.scrollTop = Math.max(0, Math.min(
              imageTop - containerHeight / 2 + imageHeight / 2,
              container.scrollHeight - containerHeight
            ));
          }
        });
      });
      return () => cancelAnimationFrame(rafId);
    }
    return () => {
      if (!viewingPost) {
        document.body.style.overflow = '';
        document.body.style.scrollbarWidth = '';
        document.body.style.msOverflowStyle = '';
        document.body.removeAttribute('data-viewing-mode');
      }
    };
  }, [viewingPost, setIsViewingModeOpen, setViewingModeDragOffset, initialImageIndex, savedScrollPosition]);

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
      // Don't unlock background scroll if another modal (e.g. viewing mode / fullscreen) is open.
      if (!viewingPost && !fullScreenImages) {
        document.body.style.overflow = '';
      }
    }
  }, [interactionModalShow]);
}
