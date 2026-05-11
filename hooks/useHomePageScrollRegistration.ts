'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useLayoutEffect } from 'react';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';

/**
 * ฟังก์ชันเอา scroll Y ของหน้า — คล้ายกับใน useViewingPost
 * iOS/Safari อาจมี scrollingElement, document.body, document.documentElement
 */
function getPageScrollY(): number {
  if (typeof window === 'undefined') return 0;
  const scrolling = document.scrollingElement as HTMLElement | null;
  const bodyTop = document.body?.scrollTop ?? 0;
  const docTop = document.documentElement?.scrollTop ?? 0;
  const scrollingTop = scrolling?.scrollTop ?? 0;
  const winTop = window.scrollY ?? window.pageYOffset ?? 0;
  return Math.max(winTop, scrollingTop, bodyTop, docTop);
}

/**
 * ฟังก์ชันตั้ง scroll Y ของหน้า — คล้ายกับใน useViewingPost
 * ตั้ง window.scrollTo + ตั้ง scrollingElement, document.body, document.documentElement
 */
function setPageScrollY(y: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  const scrolling = document.scrollingElement as HTMLElement | null;
  if (scrolling) scrolling.scrollTop = y;
  if (document.body) document.body.scrollTop = y;
  if (document.documentElement) document.documentElement.scrollTop = y;
}

/**
 * Hook สำหรับลงทะเบียน scroll ของหน้าโฮม
 * เพื่อให้ MainTabScrollContext จำตำแหน่ง scroll เมื่อกลับมาจากหน้า /notification หรือ /profile
 *
 * ทำให้หน้าโฮมเหมือนกับหน้าแจ้งเตือนและโปรไฟล์ ที่ลงทะเบียน scroll getter/setter
 */
export function useHomePageScrollRegistration() {
  const mainTabScroll = useMainTabScroll();

  useLayoutEffect(() => {
    if (!mainTabScroll) return;

    const getScroll = () => {
      try {
        return getPageScrollY();
      } catch {
        return 0;
      }
    };

    const setScroll = (y: number) => {
      try {
        setPageScrollY(y);
      } catch {
        // ignore
      }
    };

    mainTabScroll.registerScroll('/home', getScroll, setScroll);
    return () => mainTabScroll.unregisterScroll('/home');
  }, [mainTabScroll]);
}
