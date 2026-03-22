'use client'

import { useEffect, useLayoutEffect, useRef } from 'react';

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
  /** มือถือ iPhone โฮม: คืนตำแหน่งเลื่อนที่กล่องภายใน แทน window */
  applyScrollRestore?: (targetY: number) => void;
}

/** คืน scroll แบบซิงค์ — เรียกซ้ำหลังบังคับ layout หนึ่งครั้งเพื่อให้ฟีด virtual คำนวณความสูงแล้ว clamp ถูก (ไม่ใช้ rAF หลายรอบ = ลดกระพริบ) */
function applyWindowScrollY(targetY: number) {
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(Math.max(0, targetY), maxY);
  window.scrollTo({ top: y, behavior: 'auto' });
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
}

/**
 * usePostModals Hook
 * Manages side effects for viewing post, fullscreen viewer, and interaction modals
 */
export function usePostModals({
  viewingPost,
  isViewingModeOpen: _isViewingModeOpen,
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
  setIsHeaderVisible: _setIsHeaderVisible,
  applyScrollRestore,
}: UsePostModalsProps) {
  void _isViewingModeOpen;
  void _setIsHeaderVisible;
  const hadViewingPostRef = useRef(false);

  // Ensure body scroll is restored if this hook unmounts.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  /**
   * เปิด/ปิด viewing: ปิดแล้วคืน scroll ใน useLayoutEffect (ก่อน paint) — ไม่เห็นเฟรมฟีดผิดตำแหน่งแล้วค่อยเลื่อนแบบ useEffect
   */
  useLayoutEffect(() => {
    if (viewingPost) {
      hadViewingPostRef.current = true;
      setIsViewingModeOpen(true);
      setViewingModeDragOffset(0);
      return;
    }

    setIsViewingModeOpen(false);
    setViewingModeDragOffset(0);

    if (!hadViewingPostRef.current) {
      return;
    }
    hadViewingPostRef.current = false;

    document.body.style.overflow = '';
    document.body.style.scrollbarWidth = '';
    document.body.style.msOverflowStyle = '';
    document.body.removeAttribute('data-viewing-mode');

    if (applyScrollRestore) {
      applyScrollRestore(savedScrollPosition);
      if (typeof document !== 'undefined') void document.documentElement.offsetHeight;
      applyScrollRestore(savedScrollPosition);
    } else {
      applyWindowScrollY(savedScrollPosition);
      if (typeof document !== 'undefined') void document.documentElement.offsetHeight;
      applyWindowScrollY(savedScrollPosition);
    }
  }, [viewingPost, savedScrollPosition, setIsViewingModeOpen, setViewingModeDragOffset, applyScrollRestore]);

  /** เลื่อนรูปในกล่อง viewing หลัง layout (ใช้ rAF แค่ส่วนใน modal) */
  useEffect(() => {
    if (!viewingPost?.images) return;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = document.getElementById('viewing-mode-container');
        const imageElement = document.getElementById(`viewing-image-${initialImageIndex}`);
        if (container && imageElement) {
          const imageTop = imageElement.offsetTop;
          const imageHeight = imageElement.offsetHeight;
          const containerHeight = container.clientHeight;
          container.scrollTop = Math.max(
            0,
            Math.min(imageTop - containerHeight / 2 + imageHeight / 2, container.scrollHeight - containerHeight),
          );
        }
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [viewingPost?.id, viewingPost?.images?.length, initialImageIndex]);

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
  }, [
    fullScreenImages,
    setFullScreenDragOffset,
    setFullScreenVerticalDragOffset,
    setFullScreenZoomScale,
    setFullScreenZoomOrigin,
    setFullScreenIsDragging,
    setFullScreenTransitionDuration,
    setFullScreenShowDetails,
  ]);

  // Handle interaction modal effects
  useEffect(() => {
    if (interactionModalShow) {
      document.body.style.overflow = 'hidden';
    } else {
      if (!viewingPost && !fullScreenImages) {
        document.body.style.overflow = '';
      }
    }
  }, [interactionModalShow, viewingPost, fullScreenImages]);
}
