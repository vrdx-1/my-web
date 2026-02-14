'use client'

import { useState, useCallback } from 'react';

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
    setIsHeaderVisible(false);
    setSavedScrollPosition(window.scrollY);
    setInitialImageIndex(imageIndex);
    setViewingModeDragOffset(0);
    setViewingPost(post);
    setIsViewingModeOpen(true);
    return Promise.resolve();
  }, []);

  const closeViewingMode = useCallback((_setIsHeaderVisible?: (visible: boolean) => void) => {
    setIsViewingModeOpen(false);
    setViewingModeDragOffset(0);
    setViewingModeTouchStart(null);
    setViewingPost(null);
    window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
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

  return {
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
  };
}
