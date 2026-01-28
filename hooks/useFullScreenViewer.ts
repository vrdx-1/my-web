'use client'

import { useState, useRef, useCallback } from 'react';

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
  const fullScreenLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullScreenLastTapTimeRef = useRef<number>(0);
  const fullScreenLastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fullScreenDoubleTapHandledRef = useRef<boolean>(false);
  const fullScreenPinchStartRef = useRef<number>(0);
  const fullScreenPinchScaleStartRef = useRef<number>(1);
  const fullScreenPinchingRef = useRef<boolean>(false);
  const fullScreenLastClickTimeRef = useRef<number>(0);
  const fullScreenLastClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
    setTouchStart(e.touches[0].clientX);
  }, []);

  const fullScreenOnTouchStart = useCallback((e: React.TouchEvent) => {
    onTouchStart(e);
    _fullScreenTouchY = e.touches[0].clientY;
    fullScreenTouchStartYRef.current = e.touches[0].clientY;
    fullScreenTouchStartTimeRef.current = Date.now();
    setFullScreenIsDragging(true);
    setFullScreenDragOffset(0);
    setFullScreenVerticalDragOffset(0);
    setFullScreenTransitionDuration(0);
    fullScreenDoubleTapHandledRef.current = false;

    const t = (e.target as HTMLElement);
    if (!t.closest('button') && !t.closest('[data-menu-container]') && !t.closest('[data-menu-button]')) {
      if (e.touches.length >= 2) {
        fullScreenPinchingRef.current = true;
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        fullScreenPinchStartRef.current = d;
        fullScreenPinchScaleStartRef.current = fullScreenZoomScale;
        if (fullScreenLongPressTimerRef.current) {
          clearTimeout(fullScreenLongPressTimerRef.current);
          fullScreenLongPressTimerRef.current = null;
        }
      } else {
        fullScreenPinchingRef.current = false;
        fullScreenLongPressTimerRef.current = setTimeout(() => {
          setShowDownloadBottomSheet(true);
          setIsDownloadBottomSheetAnimating(true);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setIsDownloadBottomSheetAnimating(false));
          });
        }, 500);
      }
    }
  }, [fullScreenZoomScale, onTouchStart]);

  const fullScreenOnTouchMove = useCallback((e: React.TouchEvent) => {
    if (fullScreenLongPressTimerRef.current) {
      clearTimeout(fullScreenLongPressTimerRef.current);
      fullScreenLongPressTimerRef.current = null;
    }
    if (e.touches.length >= 2 && fullScreenPinchingRef.current) {
      const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      const start = fullScreenPinchStartRef.current || 1;
      const s = fullScreenPinchScaleStartRef.current * (d / start);
      const scale = Math.max(1, Math.min(4, s));
      setFullScreenZoomScale(scale);
      return;
    }
    if (touchStart === null || fullScreenTouchStartYRef.current === 0) return;
    const n = fullScreenImages?.length ?? 0;
    if (n === 0) return;
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
      if (currentImgIndex === 0) horizontalDelta = Math.max(0, horizontalDelta);
      else if (currentImgIndex === n - 1) horizontalDelta = Math.min(0, horizontalDelta);
      else horizontalDelta = Math.max(-maxDrag, Math.min(maxDrag, horizontalDelta));
      setFullScreenDragOffset(horizontalDelta);
      setFullScreenVerticalDragOffset(0);
    }
  }, [touchStart, currentImgIndex, fullScreenImages]);

  const fullScreenOnTouchEnd = useCallback((e: React.TouchEvent) => {
    if (fullScreenLongPressTimerRef.current) {
      clearTimeout(fullScreenLongPressTimerRef.current);
      fullScreenLongPressTimerRef.current = null;
    }
    const wasPinching = fullScreenPinchingRef.current;
    fullScreenPinchingRef.current = false;
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
          setFullScreenIsDragging(false);
          setFullScreenTransitionDuration(350);
          setFullScreenVerticalDragOffset(verticalDelta > 0 ? window.innerHeight : -window.innerHeight);
          setFullScreenZoomScale(1);
          setTimeout(() => {
            setFullScreenDragOffset(0);
            setFullScreenVerticalDragOffset(0);
            setFullScreenImages(null);
            setTouchStart(null);
            _fullScreenTouchY = null;
            fullScreenTouchStartYRef.current = 0;
          }, 350);
          return;
        } else if (Math.abs(fullScreenVerticalDragOffset) > 20) {
          setFullScreenVerticalDragOffset(0);
          setFullScreenIsDragging(false);
          setFullScreenTransitionDuration(250);
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

    if (diff < -40 || (velocity < -0.35 && diff < -15)) {
      if (currentImgIndex < n - 1) {
        setCurrentImgIndex((i) => i + 1);
        setFullScreenDragOffset(0);
        setFullScreenVerticalDragOffset(0);
        setFullScreenZoomScale(1);
        setFullScreenIsDragging(false);
        setFullScreenTransitionDuration(dur);
      } else {
        setFullScreenDragOffset(0);
        setFullScreenVerticalDragOffset(0);
        setFullScreenIsDragging(false);
        setFullScreenTransitionDuration(200);
      }
    } else if (diff > 40 || (velocity > 0.35 && diff > 15)) {
      if (currentImgIndex > 0) {
        setCurrentImgIndex((i) => i - 1);
        setFullScreenDragOffset(0);
        setFullScreenVerticalDragOffset(0);
        setFullScreenZoomScale(1);
        setFullScreenIsDragging(false);
        setFullScreenTransitionDuration(dur);
      } else {
        setFullScreenDragOffset(0);
        setFullScreenVerticalDragOffset(0);
        setFullScreenIsDragging(false);
        setFullScreenTransitionDuration(200);
      }
    } else {
      setFullScreenDragOffset(0);
      setFullScreenVerticalDragOffset(0);
      setFullScreenIsDragging(false);
      setFullScreenTransitionDuration(200);

      if (!wasPinching && moveX < 15 && moveY < 15) {
        const now = endTime;
        const last = fullScreenLastTapTimeRef.current;
        const lastPos = fullScreenLastTapPosRef.current;
        const near = Math.abs(endX - lastPos.x) < 50 && Math.abs(endY - lastPos.y) < 50;
        if (now - last < 350 && near) {
          fullScreenDoubleTapHandledRef.current = true;
          const container = fullScreenImageContainerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const x = ((endX - rect.left) / rect.width) * 100;
            const y = ((endY - rect.top) / rect.height) * 100;
            setFullScreenZoomOrigin(`${x}% ${y}%`);
          }
          setFullScreenZoomScale((z) => (z > 1 ? 1 : 2));
          fullScreenLastTapTimeRef.current = 0;
        } else {
          fullScreenLastTapTimeRef.current = now;
          fullScreenLastTapPosRef.current = { x: endX, y: endY };
        }
      }
    }
    setTouchStart(null);
  }, [touchStart, currentImgIndex, fullScreenImages, activePhotoMenu]);

  const fullScreenOnClick = useCallback((e: React.MouseEvent) => {
    const t = (e.target as HTMLElement);
    if (t.closest('button') || t.closest('[data-menu-container]') || t.closest('[data-menu-button]')) return;
    if (fullScreenDoubleTapHandledRef.current) {
      fullScreenDoubleTapHandledRef.current = false;
      return;
    }
    if (activePhotoMenu !== null) {
      setIsPhotoMenuAnimating(true);
      setTimeout(() => {
        setActivePhotoMenu(null);
        setIsPhotoMenuAnimating(false);
      }, 300);
      return;
    }
    const now = Date.now();
    const x = e.clientX;
    const y = e.clientY;
    const last = fullScreenLastClickTimeRef.current;
    const lastPos = fullScreenLastClickPosRef.current;
    const near = Math.abs(x - lastPos.x) < 50 && Math.abs(y - lastPos.y) < 50;
    if (now - last < 350 && near) {
      const container = fullScreenImageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const xPercent = ((x - rect.left) / rect.width) * 100;
        const yPercent = ((y - rect.top) / rect.height) * 100;
        setFullScreenZoomOrigin(`${xPercent}% ${yPercent}%`);
      }
      setFullScreenZoomScale((z) => (z > 1 ? 1 : 2));
      fullScreenLastClickTimeRef.current = 0;
      return;
    }
    fullScreenLastClickTimeRef.current = now;
    fullScreenLastClickPosRef.current = { x, y };
    setFullScreenShowDetails((prev) => !prev);
  }, [activePhotoMenu]);

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
