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
    const { error } = await supabase.rpc('increment_views', { post_id: post.id });
    if (error) {
      await supabase.from('cars').update({ views: (post.views || 0) + 1 }).eq('id', post.id);
    }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p));
  }, []);

  const closeViewingMode = useCallback((setIsHeaderVisible?: (visible: boolean) => void) => {
    setIsViewingModeOpen(false);
    setViewingModeDragOffset(0);
    setViewingModeIsDragging(false);
    setViewingModeTouchStart(null);
    if (setIsHeaderVisible) setIsHeaderVisible(true);
    setViewingPost(null);
    window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
  }, [savedScrollPosition]);

  const handleViewingModeTouchStart = useCallback((e: React.TouchEvent) => {
    setViewingModeTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setViewingModeIsDragging(true);
    setViewingModeDragOffset(0);
  }, []);

  const handleViewingModeTouchMove = useCallback((e: React.TouchEvent) => {
    // Disable horizontal swipe/drag in Viewing mode while scrolling images
    if (!viewingModeTouchStart) return;
    setViewingModeDragOffset(0);
  }, [viewingModeTouchStart]);

  const handleViewingModeTouchEnd = useCallback((e: React.TouchEvent, setIsHeaderVisible: (visible: boolean) => void) => {
    if (!viewingModeTouchStart) return;
    // Keep behavior: do not allow left-right swipe in Viewing mode
    setViewingModeDragOffset(0);
    setViewingModeIsDragging(false);
    setViewingModeTouchStart(null);
  }, [viewingModeTouchStart, viewingModeDragOffset, closeViewingMode]);

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
