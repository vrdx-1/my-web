'use client'

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseFullScreenViewerReturn {
  fullScreenImages: string[] | null;
  currentImgIndex: number;
  touchStart: number | null;
  activePhotoMenu: number | null;
  isPhotoMenuAnimating: boolean;
  fullScreenDragOffset: number;
  fullScreenEntranceOffset: number;
  fullScreenVerticalDragOffset: number;
  fullScreenIsDragging: boolean;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  showImageForDownload: string | null;
  showDownloadBottomSheet: boolean;
  isDownloadBottomSheetAnimating: boolean;
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
  fullScreenOnTouchStart: (e: React.TouchEvent) => void;
  fullScreenOnTouchMove: (e: React.TouchEvent) => void;
  fullScreenOnTouchEnd: (e: React.TouchEvent) => void;
  fullScreenOnClick: (e: React.MouseEvent) => void;
  downloadImage: (url: string) => Promise<void>;
}

export function useFullScreenViewer(): UseFullScreenViewerReturn {
  const [fullScreenImages, setFullScreenImagesBase] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);
  const [isPhotoMenuAnimating, setIsPhotoMenuAnimating] = useState(false);
  const [fullScreenDragOffset, setFullScreenDragOffset] = useState(0);
  const [fullScreenEntranceOffset, setFullScreenEntranceOffset] = useState(0);
  const [fullScreenVerticalDragOffset, setFullScreenVerticalDragOffset] = useState(0);
  const [fullScreenIsDragging, setFullScreenIsDragging] = useState(false);
  const [fullScreenTransitionDuration, setFullScreenTransitionDuration] = useState(200);
  const [fullScreenShowDetails, setFullScreenShowDetails] = useState(true);
  const [fullScreenZoomScale, setFullScreenZoomScale] = useState(1);
  const [fullScreenZoomOrigin, setFullScreenZoomOrigin] = useState<string>('50% 50%');
  const [showImageForDownload, setShowImageForDownload] = useState<string | null>(null);
  const [showDownloadBottomSheet, setShowDownloadBottomSheet] = useState(false);
  const [isDownloadBottomSheetAnimating, setIsDownloadBottomSheetAnimating] = useState(false);

  // Full screen mode: เปิดดูสลับหน้าให้ทันที ไม่มี animation
  const setFullScreenImages = useCallback((images: string[] | null) => {
    setFullScreenImagesBase(images);
    setFullScreenEntranceOffset(0);
    if (images && images.length > 0) {
      setFullScreenTransitionDuration(0);
    }
  }, []);

  const touchStartXRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = currentImgIndex;
  }, [currentImgIndex]);

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
    if (e.touches.length >= 2) return;
    if (e.touches.length === 1) {
      onTouchStart(e);
      touchStartXRef.current = e.touches[0].clientX;
      setFullScreenIsDragging(true);
      setFullScreenDragOffset(0);
      dragOffsetRef.current = 0;
      setFullScreenVerticalDragOffset(0);
      setFullScreenTransitionDuration(0);
    }
  }, [onTouchStart]);

  const fullScreenOnTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) return;
    const n = fullScreenImages?.length ?? 0;
    if (n <= 1) return;
    let deltaX = e.touches[0].clientX - touchStartXRef.current;
    const idx = currentIndexRef.current;
    if (idx === 0 && deltaX > 0) deltaX *= 0.35;
    if (idx === n - 1 && deltaX < 0) deltaX *= 0.35;
    dragOffsetRef.current = deltaX;
    setFullScreenDragOffset(deltaX);
    setFullScreenVerticalDragOffset(0);
  }, [fullScreenImages?.length]);

  const fullScreenOnTouchEnd = useCallback((e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest?.('[data-menu-button]') && !t.closest?.('[data-menu-container]') && activePhotoMenu !== null) {
      setIsPhotoMenuAnimating(true);
      setTimeout(() => {
        setActivePhotoMenu(null);
        setIsPhotoMenuAnimating(false);
      }, 300);
    }

    if (touchStart === null) {
      setTouchStart(null);
      return;
    }
    const n = fullScreenImages?.length ?? 0;
    if (n === 0) {
      setTouchStart(null);
      return;
    }
    const dragOffset = dragOffsetRef.current;
    const idx = currentIndexRef.current;
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    const threshold = Math.min(w * 0.2, 80);
    let nextIndex = idx;
    if (n > 1) {
      if (dragOffset < -threshold && idx < n - 1) nextIndex = idx + 1;
      else if (dragOffset > threshold && idx > 0) nextIndex = idx - 1;
    }

    setFullScreenTransitionDuration(200);
    setFullScreenDragOffset(0);
    dragOffsetRef.current = 0;
    setFullScreenVerticalDragOffset(0);
    setFullScreenZoomScale(1);
    setFullScreenIsDragging(false);
    if (nextIndex !== idx) setCurrentImgIndex(nextIndex);
    setTouchStart(null);
  }, [touchStart, fullScreenImages, activePhotoMenu]);

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
    setFullScreenShowDetails((prev) => !prev);
  }, [activePhotoMenu]);

  return {
    fullScreenImages,
    currentImgIndex,
    touchStart,
    activePhotoMenu,
    isPhotoMenuAnimating,
    fullScreenDragOffset,
    fullScreenEntranceOffset,
    fullScreenVerticalDragOffset,
    fullScreenIsDragging,
    fullScreenTransitionDuration,
    fullScreenShowDetails,
    fullScreenZoomScale,
    fullScreenZoomOrigin,
    showImageForDownload,
    showDownloadBottomSheet,
    isDownloadBottomSheetAnimating,
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
