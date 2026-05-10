'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useMemo } from 'react';

/** ตรงกับ useHeaderScroll — อยู่บนสุดของ feed ไม่ซ่อน header ตอนเปิด/ปิด viewing mode */
const HEADER_TOP_ZONE_PX = 200;

interface UseViewingPostReturn {
  viewingPost: any | null;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  initialImageIndex: number;
  savedScrollPosition: number;
  setViewingPost: (post: any | null) => void;
  setIsViewingModeOpen: (open: boolean) => void;
  setViewingModeDragOffset: (offset: number) => void;
  handleViewPost: (post: any, imageIndex: number, setPosts: (updater: (prev: any[]) => any[]) => void, setIsHeaderVisible: (visible: boolean) => void) => Promise<void>;
  closeViewingMode: (setIsHeaderVisible?: (visible: boolean) => void) => void;
  handleViewingModeTouchStart: (e: React.TouchEvent) => void;
  handleViewingModeTouchMove: (e: React.TouchEvent) => void;
  handleViewingModeTouchEnd: (e: React.TouchEvent, setIsHeaderVisible: (visible: boolean) => void) => void;
}

function getPageScrollY(): number {
  if (typeof window === 'undefined') return 0;
  const scrolling = document.scrollingElement as HTMLElement | null;
  const bodyTop = document.body?.scrollTop ?? 0;
  const docTop = document.documentElement?.scrollTop ?? 0;
  const scrollingTop = scrolling?.scrollTop ?? 0;
  const winTop = window.scrollY ?? window.pageYOffset ?? 0;
  return Math.max(winTop, scrollingTop, bodyTop, docTop);
}

function setPageScrollY(y: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  const scrolling = document.scrollingElement as HTMLElement | null;
  if (scrolling) scrolling.scrollTop = y;
  if (document.body) document.body.scrollTop = y;
  if (document.documentElement) document.documentElement.scrollTop = y;
}

export function useViewingPost(): UseViewingPostReturn {
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [isViewingModeOpen, setIsViewingModeOpen] = useState(false);
  const [viewingModeDragOffset, setViewingModeDragOffset] = useState(0);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [viewingModeTouchStart, setViewingModeTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);

  const handleViewPost = useCallback((
    post: any,
    imageIndex: number = 0,
    _setPosts: (updater: (prev: any[]) => any[]) => void,
    setIsHeaderVisible: (visible: boolean) => void
  ): Promise<void> => {
    const scrollY = typeof window !== 'undefined' ? getPageScrollY() : 0;
    if (scrollY > HEADER_TOP_ZONE_PX) setIsHeaderVisible(false);
    setSavedScrollPosition(scrollY);
    setInitialImageIndex(imageIndex);
    setViewingModeDragOffset(0);
    setViewingPost(post);
    setIsViewingModeOpen(true);
    return Promise.resolve();
  }, []);

  const closeViewingMode = useCallback((setIsHeaderVisible?: (visible: boolean) => void) => {
    const targetY = savedScrollPosition;
    const wasAtTop = targetY <= HEADER_TOP_ZONE_PX;

    // คืน scroll ก่อน reset state เพื่อให้ iOS ไม่มีโอกาส reset ไปที่ 0
    if (typeof window !== 'undefined' && targetY > 0) {
      setPageScrollY(targetY);
    }

    setIsViewingModeOpen(false);
    setViewingModeDragOffset(0);
    setViewingModeTouchStart(null);
    setViewingPost(null);

    // iOS Safari อาจ override scroll หลัง paint — retry 3 ครั้งผ่าน RAF
    if (typeof window !== 'undefined' && targetY > 0) {
      let attempts = 0;
      const retry = () => {
        attempts += 1;
        if (Math.abs(getPageScrollY() - targetY) > 4) {
          setPageScrollY(targetY);
        }
        if (attempts < 3) requestAnimationFrame(retry);
        else if (setIsHeaderVisible && wasAtTop) {
          requestAnimationFrame(() => setIsHeaderVisible(true));
        }
      };
      requestAnimationFrame(retry);
    } else if (setIsHeaderVisible && wasAtTop) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsHeaderVisible(true));
      });
    }
  }, [savedScrollPosition]);

  const handleViewingModeTouchStart = useCallback((e: React.TouchEvent) => {
    setViewingModeTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setViewingModeDragOffset(0);
  }, []);

  const handleViewingModeTouchMove = useCallback(() => {
    setViewingModeDragOffset(0);
  }, []);

  const handleViewingModeTouchEnd = useCallback((_e: React.TouchEvent, _setIsHeaderVisible: (visible: boolean) => void) => {
    if (!viewingModeTouchStart) return;
    setViewingModeDragOffset(0);
    setViewingModeTouchStart(null);
  }, [viewingModeTouchStart]);

  return useMemo(
    () => ({
      viewingPost,
      isViewingModeOpen,
      viewingModeDragOffset,
      initialImageIndex,
      savedScrollPosition,
      setViewingPost,
      setIsViewingModeOpen,
      setViewingModeDragOffset,
      handleViewPost,
      closeViewingMode,
      handleViewingModeTouchStart,
      handleViewingModeTouchMove,
      handleViewingModeTouchEnd,
    }),
    [
      viewingPost,
      isViewingModeOpen,
      viewingModeDragOffset,
      initialImageIndex,
      savedScrollPosition,
      handleViewPost,
      closeViewingMode,
      handleViewingModeTouchStart,
      handleViewingModeTouchMove,
      handleViewingModeTouchEnd,
    ],
  );
}
