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

  const handleViewingModeTouchMove = useCallback((e: React.TouchEvent) => {
    if (!viewingModeTouchStart) return;
    const touch = e.touches[0];
    const dx = touch.clientX - viewingModeTouchStart.x;
    const dy = touch.clientY - viewingModeTouchStart.y;

    // ถ้า gesture เอียงไปทางขวา (ซ้าย → ขวา) มากกว่าแนวตั้ง ให้ลาก card ตามนิ้ว
    if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
      const maxDrag = typeof window !== 'undefined' ? window.innerWidth : 375;
      const drag = Math.min(maxDrag, Math.max(0, dx * 0.9));
      setViewingModeDragOffset(drag);
    } else {
      // ให้ scroll แนวตั้งทำงานปกติ โดยไม่เลื่อน card ออกด้านข้าง
      setViewingModeDragOffset(0);
    }
  }, [viewingModeTouchStart]);

  const handleViewingModeTouchEnd = useCallback((e: React.TouchEvent, setIsHeaderVisible: (visible: boolean) => void) => {
    if (!viewingModeTouchStart) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - viewingModeTouchStart.x;
    const dy = touch.clientY - viewingModeTouchStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const horizontalThreshold = typeof window !== 'undefined' ? Math.min(80, window.innerWidth * 0.18) : 80;

    // 1) ปัดจากซ้ายไปขวาเพื่อปิด viewing mode (คล้าย gesture ถอยกลับที่ผู้ใช้คุ้นเคย)
    if (absDx > absDy && dx > horizontalThreshold) {
      setViewingModeDragOffset(0);
      setViewingModeIsDragging(false);
      setViewingModeTouchStart(null);
      closeViewingMode(setIsHeaderVisible);
      return;
    }

    // 2) ปัดขึ้นตอนอยู่รูปสุดท้าย/ด้านล่างสุดของ content → ปิด viewing mode
    let atBottom = false;
    if (typeof document !== 'undefined') {
      const container = document.getElementById('viewing-mode-container');
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const epsilon = 12; // เผื่อ margin/padding เล็กน้อย
        atBottom = scrollTop + clientHeight >= scrollHeight - epsilon;
      }
    }

    if (atBottom && absDy > absDx && dy < -40) {
      setViewingModeDragOffset(0);
      setViewingModeIsDragging(false);
      setViewingModeTouchStart(null);
      closeViewingMode(setIsHeaderVisible);
      return;
    }

    // 3) กรณี gesture อื่น ๆ → รีเซ็ตค่า drag กลับเหมือนเดิม
    setViewingModeDragOffset(0);
    setViewingModeIsDragging(false);
    setViewingModeTouchStart(null);
  }, [viewingModeTouchStart, closeViewingMode]);

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
