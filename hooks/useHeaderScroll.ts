'use client'

import { useState, useEffect, useRef } from 'react';

interface UseHeaderScrollOptions {
  loadingMore?: boolean;
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
}

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(options?: UseHeaderScrollOptions): UseHeaderScrollReturn {
  const { loadingMore = false, disableScrollHide = false } = options ?? {};
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (disableScrollHide) return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const scrollDelta = Math.abs(currentScrollY - lastY);

      lastScrollYRef.current = currentScrollY;

      if (loadingMore) {
        /* ขณะโหลดโพสต์ถัดไป อย่าให้ header เลื่อนลงมา */
        if (currentScrollY > lastY && currentScrollY > 80 && scrollDelta > 5) {
          setIsHeaderVisible(false);
        }
        return;
      }

      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastY && currentScrollY > 80 && scrollDelta > 5) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastY && scrollDelta > 5) {
        setIsHeaderVisible(true);
      }
    };

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
  };

  return {
    isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
    lastScrollY: lastScrollYRef.current,
    setIsHeaderVisible: wrappedSetIsHeaderVisible,
  };
}
