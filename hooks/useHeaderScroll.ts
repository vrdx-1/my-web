'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  endHomeMotionTimer,
  recordHomeMotionDuration,
  startHomeMotionTimer,
} from '@/lib/homeMotionProfiler';

const TOP_SHOW_THRESHOLD_PX = 24;
const MIN_SCROLL_DELTA_PX = 6;

interface UseHeaderScrollOptions {
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  /** ถ้า ref.current เป็น timestamp และ performance.now() < ref.current จะไม่ซ่อน header (ใช้หลังสลับแท็บโฮมเพื่อกันกระตุก) */
  suppressHideUntilRef?: React.MutableRefObject<number | null>;
}

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(options?: UseHeaderScrollOptions): UseHeaderScrollReturn {
  const { disableScrollHide = false, onVisibilityChange, suppressHideUntilRef } = options ?? {};
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const latestScrollYRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  const lastAppliedVisibleRef = useRef(true);
  const applyVisible = (visible: boolean) => {
    if (lastAppliedVisibleRef.current === visible) return;
    lastAppliedVisibleRef.current = visible;
    recordHomeMotionDuration('motion-apply', visible ? 'header-show' : 'header-hide', 0, {
      source: 'useHeaderScroll',
    });
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  };

  useEffect(() => {
    onVisibilityChangeRef.current = onVisibilityChange;
  }, [onVisibilityChange]);

  /** ปิด scroll-hide แล้วซิงก์ header/nav (context) ให้แสดงก่อน paint — กัน context ค้างจากหน้าก่อนหน้า + กระพริบเฟรมแรก */
  useEffect(() => {
    if (!disableScrollHide) return;
    lastAppliedVisibleRef.current = true;
    onVisibilityChangeRef.current?.(true);
  }, [disableScrollHide]);

  useEffect(() => {
    if (disableScrollHide) return;

    const handleScroll = () => {
      latestScrollYRef.current = window.scrollY;
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const timer = startHomeMotionTimer('scroll-handler', 'header-scroll-frame');
        const currentScrollY = latestScrollYRef.current;
        const previousScrollY = lastScrollYRef.current;
        const scrollDelta = currentScrollY - previousScrollY;
        lastScrollYRef.current = currentScrollY;

        if (currentScrollY <= TOP_SHOW_THRESHOLD_PX) {
          applyVisible(true);
          endHomeMotionTimer(timer, {
            action: 'top-threshold-show',
            currentScrollY,
            scrollDelta,
          });
          return;
        }

        if (Math.abs(scrollDelta) < MIN_SCROLL_DELTA_PX) {
          endHomeMotionTimer(timer, {
            action: 'ignore-small-delta',
            currentScrollY,
            scrollDelta,
          });
          return;
        }

        if (scrollDelta > 0) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (suppressHideUntilRef?.current != null && now < suppressHideUntilRef.current) {
            endHomeMotionTimer(timer, {
              action: 'suppressed-hide',
              currentScrollY,
              scrollDelta,
            });
            return;
          }
          applyVisible(false);
          endHomeMotionTimer(timer, {
            action: 'hide',
            currentScrollY,
            scrollDelta,
          });
          return;
        }

        applyVisible(true);
        endHomeMotionTimer(timer, {
          action: 'show',
          currentScrollY,
          scrollDelta,
        });
      });
    };

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollYRef.current = scrollY;
    latestScrollYRef.current = scrollY;

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [disableScrollHide, suppressHideUntilRef]);

  // เมื่อ disableScrollHide เป็น true ให้ lock header ไว้เสมอ
  const wrappedSetIsHeaderVisible = useCallback((visible: boolean) => {
    if (disableScrollHide) {
      // ไม่ให้เปลี่ยนค่า header เมื่อ disableScrollHide เป็น true
      return;
    }
    applyVisible(visible);
  }, [disableScrollHide]);

  return useMemo(
    () => ({
      isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
      lastScrollY: 0,
      setIsHeaderVisible: wrappedSetIsHeaderVisible,
    }),
    [disableScrollHide, isHeaderVisible, wrappedSetIsHeaderVisible],
  );
}
