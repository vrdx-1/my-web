'use client'

import { useState, useEffect, useRef } from 'react';

/** เมื่อ scroll อยู่ในโซนนี้ (โพสบนสุด) Header ต้องไม่เลื่อนออก — ครอบคลุม spacer + โพสต์แรกของ feed */
const HEADER_TOP_ZONE_PX = 200;
/** Throttle การอัปเดต visibility เพื่อลด re-render จาก scroll (สมูทขึ้น) */
const VISIBILITY_THROTTLE_MS = 120;

interface UseHeaderScrollOptions {
  loadingMore?: boolean;
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
  /** เรียกทันทีใน scroll handler (ไม่รอ re-render) เพื่อให้ header/nav ตามจังหวะเลื่อน */
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
  const { loadingMore = false, disableScrollHide = false, onVisibilityChange, suppressHideUntilRef } = options ?? {};
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;
  const lastAppliedVisibleRef = useRef(true);
  const throttleUntilRef = useRef(0);

  const applyVisible = (visible: boolean) => {
    if (lastAppliedVisibleRef.current === visible) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now < throttleUntilRef.current) return;
    if (visible === false && suppressHideUntilRef?.current != null && now < suppressHideUntilRef.current) return;
    throttleUntilRef.current = now + VISIBILITY_THROTTLE_MS;
    lastAppliedVisibleRef.current = visible;
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  };

  useEffect(() => {
    if (disableScrollHide) return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const scrollDelta = currentScrollY - lastY;

      lastScrollYRef.current = currentScrollY;

      // อยู่โพสบนสุด (โพสต์แรกของ feed): Header ต้องไม่สไลด์ออก
      if (currentScrollY <= HEADER_TOP_ZONE_PX) {
        applyVisible(true);
        return;
      }

      if (loadingMore) {
        if (scrollDelta > 0 && currentScrollY > 50) {
          applyVisible(false);
        }
        return;
      }

      if (scrollDelta > 0) {
        applyVisible(false);
      } else if (scrollDelta < 0) {
        applyVisible(true);
      }
    };

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollYRef.current = scrollY;
    if (scrollY <= HEADER_TOP_ZONE_PX) applyVisible(true);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, disableScrollHide]);

  // เมื่อ disableScrollHide เป็น true ให้ lock header ไว้เสมอ
  const wrappedSetIsHeaderVisible = (visible: boolean) => {
    if (disableScrollHide) {
      // ไม่ให้เปลี่ยนค่า header เมื่อ disableScrollHide เป็น true
      return;
    }
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  };

  return {
    isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
    lastScrollY: lastScrollYRef.current,
    setIsHeaderVisible: wrappedSetIsHeaderVisible,
  };
}
