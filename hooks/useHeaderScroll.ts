'use client'

import { useEffect, useRef, useState } from 'react';

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
  onVisibilityChangeRef.current = onVisibilityChange;
  const lastAppliedVisibleRef = useRef(true);
  const applyVisible = (visible: boolean) => {
    if (lastAppliedVisibleRef.current === visible) return;
    lastAppliedVisibleRef.current = visible;
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  };

  /** ปิด scroll-hide แล้วซิงก์ header/nav (context) ให้แสดงก่อน paint — กัน context ค้างจากหน้าก่อนหน้า + กระพริบเฟรมแรก */
  useEffect(() => {
    if (!disableScrollHide) return;
    lastAppliedVisibleRef.current = true;
    setIsHeaderVisible(true);
    onVisibilityChangeRef.current?.(true);
  }, [disableScrollHide]);

  useEffect(() => {
    if (disableScrollHide) return;

    const handleScroll = () => {
      latestScrollYRef.current = window.scrollY;
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const currentScrollY = latestScrollYRef.current;
        const lastScrollY = lastScrollYRef.current;
        const scrollDelta = currentScrollY - lastScrollY;
        lastScrollYRef.current = currentScrollY;

        if (currentScrollY <= TOP_SHOW_THRESHOLD_PX) {
          applyVisible(true);
          return;
        }

        if (Math.abs(scrollDelta) < MIN_SCROLL_DELTA_PX) {
          return;
        }

        if (scrollDelta > 0) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (suppressHideUntilRef?.current != null && now < suppressHideUntilRef.current) {
            return;
          }
          applyVisible(false);
          return;
        }

        applyVisible(true);
      });
    };

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollYRef.current = scrollY;
    latestScrollYRef.current = scrollY;
    if (scrollY <= TOP_SHOW_THRESHOLD_PX) {
      applyVisible(true);
    }

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
  const wrappedSetIsHeaderVisible = (visible: boolean) => {
    if (disableScrollHide) {
      // ไม่ให้เปลี่ยนค่า header เมื่อ disableScrollHide เป็น true
      return;
    }
    applyVisible(visible);
  };

  return {
    isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
    lastScrollY: lastScrollYRef.current,
    setIsHeaderVisible: wrappedSetIsHeaderVisible,
  };
}
