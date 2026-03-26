'use client';

import { useEffect } from 'react';

interface UsePostModalsBackHandlerOptions {
  addBackStep: (handler: () => void) => (() => void) | void;
  fullScreenImages: string[] | null;
  activePhotoMenu: number | null;
  setFullScreenImages: (images: string[] | null) => void;
  setIsPhotoMenuAnimating: (animating: boolean) => void;
  setActivePhotoMenu: (menu: number | null) => void;
  viewingPost: any;
  onCloseViewingPost: () => void;
}

export function usePostModalsBackHandler(options: UsePostModalsBackHandlerOptions) {
  const {
    addBackStep,
    fullScreenImages,
    activePhotoMenu,
    setFullScreenImages,
    setIsPhotoMenuAnimating,
    setActivePhotoMenu,
    viewingPost,
    onCloseViewingPost,
  } = options;

  useEffect(() => {
    if (!fullScreenImages) return;
    const close = () => {
      setFullScreenImages(null);
      if (activePhotoMenu !== null) {
        setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          setActivePhotoMenu(null);
          setIsPhotoMenuAnimating(false);
        }, 300);
      }
    };
    return addBackStep(close);
  }, [
    addBackStep,
    fullScreenImages,
    activePhotoMenu,
    setFullScreenImages,
    setIsPhotoMenuAnimating,
    setActivePhotoMenu,
  ]);

  useEffect(() => {
    if (!viewingPost) return;
    const close = () => onCloseViewingPost();
    return addBackStep(close);
  }, [addBackStep, viewingPost, onCloseViewingPost]);
}
