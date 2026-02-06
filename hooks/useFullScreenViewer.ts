'use client'

import { useState, useRef, useCallback, useEffect } from 'react';

let _fullScreenTouchY: number | null = null;

interface UseFullScreenViewerReturn {
  // State
  fullScreenImages: string[] | null;
  currentImgIndex: number;
  touchStart: number | null;
  activePhotoMenu: number | null;
  isPhotoMenuAnimating: boolean;
  fullScreenDragOffset: number;
  fullScreenVerticalDragOffset: number;
  fullScreenIsDragging: boolean;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  showImageForDownload: string | null;
  showDownloadBottomSheet: boolean;
  isDownloadBottomSheetAnimating: boolean;
  
  // Refs
  fullScreenImageContainerRef: React.RefObject<HTMLDivElement>;
  
  // Setters
  setFullScreenImages: (images: string[] | null) => void;
  setCurrentImgIndex: (index: number | ((prev: number) => number)) => void;
  setActivePhotoMenu: (index: number | null) => void;
  setIsPhotoMenuAnimating: (animating: boolean) => void;
  setShowImageForDownload: (url: string | null) => void;
  setShowDownloadBottomSheet: (show: boolean) => void;
  setIsDownloadBottomSheetAnimating: (animating: boolean) => void;
  setFullScreenDragOffset: (offset: number) => void;
  setFullScreenVerticalDragOffset: (offset: number) => void;
  setFullScreenZoomScale: (scale: number | ((prev: number) => number)) => void;
  setFullScreenZoomOrigin: (origin: string) => void;
  setFullScreenIsDragging: (dragging: boolean) => void;
  setFullScreenTransitionDuration: (duration: number) => void;
  setFullScreenShowDetails: (show: boolean | ((prev: boolean) => boolean)) => void;
  
  // Handlers
  fullScreenOnTouchStart: (e: React.TouchEvent) => void;
  fullScreenOnTouchMove: (e: React.TouchEvent) => void;
  fullScreenOnTouchEnd: (e: React.TouchEvent) => void;
  fullScreenOnClick: (e: React.MouseEvent) => void;
  downloadImage: (url: string) => Promise<void>;
}

export function useFullScreenViewer(): UseFullScreenViewerReturn {
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);
  const [isPhotoMenuAnimating, setIsPhotoMenuAnimating] = useState(false);
  const [fullScreenDragOffset, setFullScreenDragOffset] = useState(0);
  const [fullScreenVerticalDragOffset, setFullScreenVerticalDragOffset] = useState(0);
  const [fullScreenIsDragging, setFullScreenIsDragging] = useState(false);
  const [fullScreenTransitionDuration, setFullScreenTransitionDuration] = useState(200);
  const [fullScreenShowDetails, setFullScreenShowDetails] = useState(true);
  const [fullScreenZoomScale, setFullScreenZoomScale] = useState(1);
  const [fullScreenZoomOrigin, setFullScreenZoomOrigin] = useState<string>('50% 50%');
  const [showImageForDownload, setShowImageForDownload] = useState<string | null>(null);
  const [showDownloadBottomSheet, setShowDownloadBottomSheet] = useState(false);
  const [isDownloadBottomSheetAnimating, setIsDownloadBottomSheetAnimating] = useState(false);

  // Refs
  const fullScreenImageContainerRef = useRef<HTMLDivElement | null>(null);
  const fullScreenTouchStartTimeRef = useRef<number>(0);
  const fullScreenTouchStartYRef = useRef<number>(0);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const isPinchingRef = useRef(false);

  const downloadImage = useCallback(async (url: string) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        setShowImageForDownload(url);
        setActivePhotoMenu(null);
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        const fileName = `car-image-${Date.now()}.jpg`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
        setActivePhotoMenu(null);
      }
    } catch (err) {
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart(e.touches[0].clientX);
    }
  }, []);

  const fullScreenOnTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      // ปล่อยให้บราวเซอร์จัดการ pinch-zoom เอง (ไม่ใช้ custom zoom)
      isPinchingRef.current = false;
      pinchStartDistanceRef.current = null;
      return;
    }

    isPinchingRef.current = false;
    if (e.touches.length === 1) {
      onTouchStart(e);
      _fullScreenTouchY = e.touches[0].clientY;
      fullScreenTouchStartYRef.current = e.touches[0].clientY;
      fullScreenTouchStartTimeRef.current = Date.now();
      setFullScreenIsDragging(true);
      setFullScreenDragOffset(0);
      setFullScreenVerticalDragOffset(0);
      setFullScreenTransitionDuration(0);
    }
  }, [onTouchStart, fullScreenZoomScale, setFullScreenZoomOrigin]);

  const fullScreenOnTouchMove = useCallback((e: React.TouchEvent) => {
    // ถ้ามีหลายจุดสัมผัส ให้ปล่อยให้บราวเซอร์ handle pinch‑zoom เอง
    if (e.touches.length >= 2) {
      return;
    }

    if (touchStart === null || fullScreenTouchStartYRef.current === 0) return;
    const n = fullScreenImages?.length ?? 0;
    if (n === 0 || e.touches.length === 0) return;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    
    const deltaX = clientX - touchStart;
    const deltaY = clientY - fullScreenTouchStartYRef.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absY > absX) {
      let verticalDelta = deltaY;
      const maxVerticalDrag = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 500;
      verticalDelta = Math.max(-maxVerticalDrag, Math.min(maxVerticalDrag, verticalDelta));
      setFullScreenVerticalDragOffset(verticalDelta);
      setFullScreenDragOffset(0);
    } else {
      let horizontalDelta = deltaX;
      const maxDrag = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 400;

      // Popular "rubber-band" feel on edges (like common gallery apps).
      if (currentImgIndex === 0 && horizontalDelta > 0) {
        horizontalDelta = horizontalDelta * 0.35;
      } else if (currentImgIndex === n - 1 && horizontalDelta < 0) {
        horizontalDelta = horizontalDelta * 0.35;
      } else {
        horizontalDelta = Math.max(-maxDrag, Math.min(maxDrag, horizontalDelta));
      }
      setFullScreenDragOffset(horizontalDelta);
      setFullScreenVerticalDragOffset(0);
    }
  }, [touchStart, currentImgIndex, fullScreenImages]);

  const fullScreenOnTouchEnd = useCallback((e: React.TouchEvent) => {
    // ไม่จัดการ pinch‑zoom ด้วย custom logic แล้ว ปล่อยให้บราวเซอร์ทำเอง
    isPinchingRef.current = false;
    pinchStartDistanceRef.current = null;
    const startY = fullScreenTouchStartYRef.current;

    const t = (e.target as HTMLElement);
    if (!t.closest?.('[data-menu-button]') && !t.closest?.('[data-menu-container]')) {
      if (activePhotoMenu !== null) {
        setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          setActivePhotoMenu(null);
          setIsPhotoMenuAnimating(false);
        }, 300);
      }
      if (_fullScreenTouchY != null && fullScreenTouchStartYRef.current !== 0) {
        const ey = e.changedTouches[0].clientY;
        const dy = Math.abs(ey - _fullScreenTouchY);
        const dx = touchStart != null ? Math.abs(touchStart - e.changedTouches[0].clientX) : 0;
        const verticalDelta = ey - fullScreenTouchStartYRef.current;
        
        if (dy > 40 && dy > dx) {
          // ปัดขึ้น/ลงเพื่อปิด full screen (คุ้นเคยแบบ Instagram / Photos)
          setFullScreenIsDragging(false);
          setFullScreenDragOffset(0);
          setFullScreenVerticalDragOffset(0);
          setFullScreenTransitionDuration(0);
          setTouchStart(null);
          _fullScreenTouchY = null;
          fullScreenTouchStartYRef.current = 0;
          setFullScreenZoomScale(1);
          setFullScreenZoomOrigin('50% 50%');
          setFullScreenImages(null);
          return;
        } else if (Math.abs(fullScreenVerticalDragOffset) > 20) {
          setFullScreenVerticalDragOffset(0);
          setFullScreenIsDragging(false);
          setFullScreenTransitionDuration(0);
          setTouchStart(null);
          _fullScreenTouchY = null;
          fullScreenTouchStartYRef.current = 0;
          return;
        }
      }
    }
    _fullScreenTouchY = null;
    fullScreenTouchStartYRef.current = 0;

    if (touchStart === null) {
      setTouchStart(null);
      return;
    }
    const n = fullScreenImages?.length ?? 0;
    if (n === 0) {
      setTouchStart(null);
      return;
    }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();
    const elapsed = Math.max(1, endTime - fullScreenTouchStartTimeRef.current);
    const velocity = (endX - touchStart) / elapsed;
    const diff = endX - touchStart;
    const moveX = Math.abs(diff);
    const moveY = Math.abs(endY - startY);
    const fast = Math.abs(velocity) > 0.5;
    const dur = fast ? 120 : 200;

    // Horizontal swipe: follow finger, then snap with animation (common gallery behavior).
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 375;
    const threshold = Math.min(80, screenW * 0.18); // typical paging threshold
    const shouldGoNext = diff < -threshold || (velocity < -0.35 && diff < -15);
    const shouldGoPrev = diff > threshold || (velocity > 0.35 && diff > 15);

    let nextIndex = currentImgIndex;
    if (moveX > moveY * 1.2) {
      if (shouldGoNext) nextIndex = Math.min(n - 1, currentImgIndex + 1);
      else if (shouldGoPrev) nextIndex = Math.max(0, currentImgIndex - 1);
    }

    setFullScreenTransitionDuration(dur);
    setFullScreenDragOffset(0);
    setFullScreenVerticalDragOffset(0);
    setFullScreenZoomScale(1);
    setFullScreenIsDragging(false);
    if (nextIndex !== currentImgIndex) setCurrentImgIndex(nextIndex);

    setTouchStart(null);
  }, [touchStart, currentImgIndex, fullScreenImages, activePhotoMenu]);

  const fullScreenOnClick = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('[data-menu-container]') || t.closest('[data-menu-button]')) return;
    if (activePhotoMenu !== null) {
      setIsPhotoMenuAnimating(true);
      setTimeout(() => {
        setActivePhotoMenu(null);
        setIsPhotoMenuAnimating(false);
      }, 300);
      return;
    }
    // แตะครั้งเดียว (หรือหลายครั้งติดกัน) ให้ทำเหมือนเดิม: toggle แสดง/ซ่อนรายละเอียด
    setFullScreenShowDetails((prev) => !prev);
  }, [activePhotoMenu, setIsPhotoMenuAnimating, setActivePhotoMenu, setFullScreenShowDetails]);

  return {
    // State
    fullScreenImages,
    currentImgIndex,
    touchStart,
    activePhotoMenu,
    isPhotoMenuAnimating,
    fullScreenDragOffset,
    fullScreenVerticalDragOffset,
    fullScreenIsDragging,
    fullScreenTransitionDuration,
    fullScreenShowDetails,
    fullScreenZoomScale,
    fullScreenZoomOrigin,
    showImageForDownload,
    showDownloadBottomSheet,
    isDownloadBottomSheetAnimating,
    
    // Refs
    fullScreenImageContainerRef,
    
    // Setters
    setFullScreenImages,
    setCurrentImgIndex,
    setActivePhotoMenu,
    setIsPhotoMenuAnimating,
    setShowImageForDownload,
    setShowDownloadBottomSheet,
    setIsDownloadBottomSheetAnimating,
    setFullScreenDragOffset,
    setFullScreenVerticalDragOffset,
    setFullScreenZoomScale,
    setFullScreenZoomOrigin,
    setFullScreenIsDragging,
    setFullScreenTransitionDuration,
    setFullScreenShowDetails,
    
    // Handlers
    fullScreenOnTouchStart,
    fullScreenOnTouchMove,
    fullScreenOnTouchEnd,
    fullScreenOnClick,
    downloadImage,
  };
}
