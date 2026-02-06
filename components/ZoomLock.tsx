'use client'

import { useEffect } from 'react';
import { isFullScreenViewerOpen } from '@/utils/fullScreenMode';

/**
 * Global browser-zoom lock.
 * - Blocks Ctrl/Cmd + wheel and Ctrl/Cmd + +/-/0 across the app
 * - Blocks iOS Safari gesture zoom events
 * - EXCEPTION: when FullScreenImageViewer is open (data attribute present),
 *   we allow zoom so users can zoom the image.
 */
export default function ZoomLock() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // ปิดการ zoom ทุกรูปแบบ (รวมถึงตอน Full screen mode)
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // ปิดการ zoom ทุกรูปแบบ (รวมถึงตอน Full screen mode)
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key;
      if (k === '+' || k === '=' || k === '-' || k === '_' || k === '0') {
        e.preventDefault();
      }
    };

    const onGesture = (e: Event) => {
      // ปิดการ zoom ทุกรูปแบบ (รวมถึงตอน Full screen mode)
      e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('gesturestart', onGesture as any, { passive: false } as any);
    window.addEventListener('gesturechange', onGesture as any, { passive: false } as any);
    window.addEventListener('gestureend', onGesture as any, { passive: false } as any);

    return () => {
      window.removeEventListener('wheel', onWheel as any);
      window.removeEventListener('keydown', onKeyDown as any);
      window.removeEventListener('gesturestart', onGesture as any);
      window.removeEventListener('gesturechange', onGesture as any);
      window.removeEventListener('gestureend', onGesture as any);
    };
  }, []);

  return null;
}

