'use client';

import { useEffect } from 'react';

export function useOverlayScrollLock(shouldLock: boolean) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const prevHtmlOverscrollBehavior = html.style.overscrollBehavior;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscrollBehavior;
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscrollBehavior;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscrollBehavior;
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscrollBehavior;
    };
  }, [shouldLock]);
}

