'use client'

import { useEffect } from 'react';
import { useBackHandler } from '@/components/BackHandlerContext';

/**
 * Custom hook สำหรับจัดการ back handlers ในหน้า Home
 * แยก logic เพื่อลดความซับซ้อนของ HomeContent
 */
export function useHomeBackHandlers({
  fullScreenViewer,
  viewingPostHook,
}: {
  fullScreenViewer: {
    fullScreenImages: string[] | null;
    setFullScreenImages: (images: string[] | null) => void;
    activePhotoMenu: number | null;
    setIsPhotoMenuAnimating: (animating: boolean) => void;
    setActivePhotoMenu: (menu: number | null) => void;
  };
  viewingPostHook: {
    viewingPost: any | null;
    closeViewingMode: () => void;
  };
}) {
  const { addBackStep } = useBackHandler();

  // กดย้อนกลับบนมือถือ: ปิด fullscreen / viewing ตามสเต็ป
  useEffect(() => {
    if (!fullScreenViewer.fullScreenImages) return;
    const close = () => {
      fullScreenViewer.setFullScreenImages(null);
      if (fullScreenViewer.activePhotoMenu !== null) {
        fullScreenViewer.setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          fullScreenViewer.setActivePhotoMenu(null);
          fullScreenViewer.setIsPhotoMenuAnimating(false);
        }, 300);
      }
    };
    return addBackStep(close);
  }, [fullScreenViewer.fullScreenImages, addBackStep]);

  useEffect(() => {
    if (!viewingPostHook.viewingPost) return;
    const close = () => {
      viewingPostHook.closeViewingMode();
    };
    return addBackStep(close);
  }, [viewingPostHook.viewingPost, addBackStep]);
}
