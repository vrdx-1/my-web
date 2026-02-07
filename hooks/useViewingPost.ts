'use client'

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseViewingPostReturn {
  // State
  viewingPost: any | null;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  viewingModeIsDragging: boolean;
  initialImageIndex: number;
  viewingModeTouchStart: { x: number; y: number } | null;
  savedScrollPosition: number;
  
  // Setters
  setViewingPost: (post: any | null) => void;
  setIsViewingModeOpen: (open: boolean) => void;
  setViewingModeDragOffset: (offset: number) => void;
  setViewingModeIsDragging: (dragging: boolean) => void;
  setInitialImageIndex: (index: number) => void;
  setSavedScrollPosition: (position: number) => void;
  
  // Handlers
  handleViewPost: (post: any, imageIndex: number, setPosts: (updater: (prev: any[]) => any[]) => void, setIsHeaderVisible: (visible: boolean) => void) => Promise<void>;
  closeViewingMode: (setIsHeaderVisible?: (visible: boolean) => void) => void;
  handleViewingModeTouchStart: (e: React.TouchEvent) => void;
  handleViewingModeTouchMove: (e: React.TouchEvent) => void;
  handleViewingModeTouchEnd: (e: React.TouchEvent, setIsHeaderVisible: (visible: boolean) => void) => void;
}

export function useViewingPost(): UseViewingPostReturn {
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [isViewingModeOpen, setIsViewingModeOpen] = useState(false);
  const [viewingModeDragOffset, setViewingModeDragOffset] = useState(0);
  const [viewingModeIsDragging, setViewingModeIsDragging] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [viewingModeTouchStart, setViewingModeTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);

  const handleViewPost = useCallback(async (
    post: any,
    imageIndex: number = 0,
    setPosts: (updater: (prev: any[]) => any[]) => void,
    setIsHeaderVisible: (visible: boolean) => void
  ) => {
    setIsHeaderVisible(false);
    setSavedScrollPosition(window.scrollY);
    setInitialImageIndex(imageIndex);
    setIsViewingModeOpen(false);
    setViewingPost(post);
  }, []);

  const closeViewingMode = useCallback((setIsHeaderVisible?: (visible: boolean) => void) => {
    setIsViewingModeOpen(false);
    setViewingModeDragOffset(0);
    setViewingModeIsDragging(false);
    setViewingModeTouchStart(null);
    setViewingPost(null);
    window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
  }, [savedScrollPosition]);

  const handleViewingModeTouchStart = useCallback((e: React.TouchEvent) => {
    setViewingModeTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setViewingModeIsDragging(true);
    setViewingModeDragOffset(0);
  }, []);

  const handleViewingModeTouchMove = useCallback((_e: React.TouchEvent) => {
    // ไม่อนุญาตให้ปัดซ้ายขวา — คง offset แนวนอนเป็น 0 เสมอ (scroll แนวตั้งยังทำงานปกติใน container)
    setViewingModeDragOffset(0);
  }, []);

  const handleViewingModeTouchEnd = useCallback((e: React.TouchEvent, setIsHeaderVisible: (visible: boolean) => void) => {
    // ปิดการปัดเพื่อออกจาก viewing mode ทั้งหมด
    // ให้ผู้ใช้ปิดได้เฉพาะการกดปุ่ม back เท่านั้น
    if (!viewingModeTouchStart) return;

    // รีเซ็ต gesture state กลับเหมือนเดิม โดยไม่ปิด viewing mode
    setViewingModeDragOffset(0);
    setViewingModeIsDragging(false);
    setViewingModeTouchStart(null);
  }, [viewingModeTouchStart, setViewingModeDragOffset, setViewingModeIsDragging, setViewingModeTouchStart]);

  return {
    // State
    viewingPost,
    isViewingModeOpen,
    viewingModeDragOffset,
    viewingModeIsDragging,
    initialImageIndex,
    viewingModeTouchStart,
    savedScrollPosition,
    
    // Setters
    setViewingPost,
    setIsViewingModeOpen,
    setViewingModeDragOffset,
    setViewingModeIsDragging,
    setInitialImageIndex,
    setSavedScrollPosition,
    
    // Handlers
    handleViewPost,
    closeViewingMode,
    handleViewingModeTouchStart,
    handleViewingModeTouchMove,
    handleViewingModeTouchEnd,
  };
}
