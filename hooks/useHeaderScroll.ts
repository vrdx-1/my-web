'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react';

/** เมื่อ scroll อยู่ในโซนนี้ (โพสบนสุด) Header ต้องไม่เลื่อนออก — ครอบคลุม spacer + โพสต์แรกของ feed */
const HEADER_TOP_ZONE_PX = 200;
/** เลื่อนลงเกินนี้ = โซนที่ซ่อน header ได้ (ต่ำลง = ไม่ต้องเลื่อนไกลจากบนจึงจะซ่อน — smooth กว่า 240px) */
const HEADER_HIDE_THRESHOLD_PX = 200;
/** โซนบน: แสดง header เต็มเมื่อ scroll ไม่เกินนี้ */
const HEADER_SHOW_THRESHOLD_PX = 170;
/** Throttle เฉพาะตอนซ่อน header เพื่อลด re-render (ตอนแสดงไม่ throttle ให้ตอบทันที) */
const VISIBILITY_THROTTLE_MS = 100;
/**
 * delta ต่อเฟรมต้องเกินนี้ถึงจะซ่อน/แสดง — ค่าเดิม 18 ทำให้เลื่อนช้าแทบไม่ติด (ต้องเลื่อนมากกว่าปกติ)
 * 8px ยังกัน jitter จาก layout ~1–3px ได้
 */
const MIN_SCROLL_DELTA_PX = 8;
/** หลังโหลดโพส/เปลี่ยนจำนวนโพส — ไม่ตอบ scroll ช่วงสั้นๆ ให้ layout นิ่ง (virtualizer วัดความสูงท้ายฟีดทำให้มี scroll ปลอม) */
const LAYOUT_SETTLE_IGNORE_MS = 260;
/** หลัง expand/collapse caption ของโพสต์ ให้ข้าม scroll-driven visibility ชั่วคราว กัน header/nav กระตุก */
const CAPTION_TOGGLE_IGNORE_MS = 420;

interface UseHeaderScrollOptions {
  loadingMore?: boolean;
  /** จำนวนโพสในฟีด (เช่น posts.length) — เมื่อเพิ่มโพสจะกัน scroll ปลอมช่วง layout settle */
  feedPostCount?: number;
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
  /** เรียกทันทีใน scroll handler (ไม่รอ re-render) เพื่อให้ header/nav ตามจังหวะเลื่อน */
  onVisibilityChange?: (visible: boolean) => void;
  /** ถ้า ref.current เป็น timestamp และ performance.now() < ref.current จะไม่ซ่อน header (ใช้หลังสลับแท็บโฮมเพื่อกันกระตุก) */
  suppressHideUntilRef?: React.MutableRefObject<number | null>;
  /** ปรับความไวของพฤติกรรมซ่อน/แสดงตามการเลื่อน โดยไม่ต้องแก้ค่าคงที่ทั้งระบบ */
  scrollTuning?: {
    showThresholdPx?: number;
    hideThresholdPx?: number;
    minScrollDeltaPx?: number;
    visibilityThrottleMs?: number;
    layoutSettleIgnoreMs?: number;
    captionToggleIgnoreMs?: number;
  };
}

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(options?: UseHeaderScrollOptions): UseHeaderScrollReturn {
  const { loadingMore = false, feedPostCount, disableScrollHide = false, onVisibilityChange, suppressHideUntilRef, scrollTuning } = options ?? {};
  const showThresholdPx = scrollTuning?.showThresholdPx ?? HEADER_SHOW_THRESHOLD_PX;
  const hideThresholdPx = scrollTuning?.hideThresholdPx ?? HEADER_HIDE_THRESHOLD_PX;
  const minScrollDeltaPx = scrollTuning?.minScrollDeltaPx ?? MIN_SCROLL_DELTA_PX;
  const visibilityThrottleMs = scrollTuning?.visibilityThrottleMs ?? VISIBILITY_THROTTLE_MS;
  const layoutSettleIgnoreMs = scrollTuning?.layoutSettleIgnoreMs ?? LAYOUT_SETTLE_IGNORE_MS;
  const captionToggleIgnoreMs = scrollTuning?.captionToggleIgnoreMs ?? CAPTION_TOGGLE_IGNORE_MS;
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;
  const lastAppliedVisibleRef = useRef(true);
  const throttleUntilRef = useRef(0);
  /** ถึงเวลานี้ก่อนค่อยให้ scroll ควบคุม header/nav อีกครั้ง */
  const ignoreScrollDrivenVisibilityUntilRef = useRef(0);
  const prevLoadingMoreRef = useRef(loadingMore);
  const prevFeedPostCountRef = useRef(feedPostCount);

  const scheduleLayoutSettleIgnore = () => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const schedule = () => {
      ignoreScrollDrivenVisibilityUntilRef.current = performance.now() + layoutSettleIgnoreMs;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(schedule);
    });
  };

  useEffect(() => {
    if (prevLoadingMoreRef.current && !loadingMore) {
      scheduleLayoutSettleIgnore();
    }
    prevLoadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    if (feedPostCount === undefined) return;
    if (prevFeedPostCountRef.current === undefined) {
      prevFeedPostCountRef.current = feedPostCount;
      return;
    }
    if (prevFeedPostCountRef.current !== feedPostCount) {
      prevFeedPostCountRef.current = feedPostCount;
      scheduleLayoutSettleIgnore();
    }
  }, [feedPostCount]);

  useEffect(() => {
    if (typeof window === 'undefined' || disableScrollHide) return;

    const handleCaptionToggle = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      ignoreScrollDrivenVisibilityUntilRef.current = now + captionToggleIgnoreMs;
      lastScrollYRef.current = window.scrollY;
    };

    window.addEventListener('postcard:caption-toggle', handleCaptionToggle as EventListener);
    return () => window.removeEventListener('postcard:caption-toggle', handleCaptionToggle as EventListener);
  }, [disableScrollHide]);

  const applyVisible = (visible: boolean, throttleHideOnly = true) => {
    if (lastAppliedVisibleRef.current === visible) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (visible === false && throttleHideOnly && now < throttleUntilRef.current) return;
    if (visible === false && suppressHideUntilRef?.current != null && now < suppressHideUntilRef.current) return;
    if (visible === false) throttleUntilRef.current = now + visibilityThrottleMs;
    lastAppliedVisibleRef.current = visible;
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  };

  /** ปิด scroll-hide แล้วซิงก์ header/nav (context) ให้แสดงก่อน paint — กัน context ค้างจากหน้าก่อนหน้า + กระพริบเฟรมแรก */
  useLayoutEffect(() => {
    if (!disableScrollHide) return;
    lastAppliedVisibleRef.current = true;
    setIsHeaderVisible(true);
    onVisibilityChangeRef.current?.(true);
  }, [disableScrollHide]);

  useEffect(() => {
    if (disableScrollHide) return;
    let rafId: number | null = null;

    const runScrollLogic = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const scrollDelta = currentScrollY - lastY;

      lastScrollYRef.current = currentScrollY;

      // กำลังโหลดโพสถัดไป — ไม่เปลี่ยน header จาก scroll (กันโหลด DOM/รูป ทำให้ scroll event ปลอม)
      if (loadingMore) {
        return;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < ignoreScrollDrivenVisibilityUntilRef.current) {
        return;
      }

      // อยู่โซนบนสุดจริง (แสดง header ทันที ไม่ throttle)
      if (currentScrollY <= showThresholdPx) {
        applyVisible(true, false);
        return;
      }
      // เลื่อนลงลึกเกิน threshold ค่อยซ่อน (hysteresis ไม่กระตุกที่ขอบ)
      if (currentScrollY >= hideThresholdPx) {
        if (scrollDelta > minScrollDeltaPx) {
          applyVisible(false);
        } else if (scrollDelta < -minScrollDeltaPx) {
          applyVisible(true, false);
        }
        return;
      }
      // ระหว่าง SHOW–HIDE: เลื่อนขึ้นชัดเจนเท่านั้นค่อยแสดง header (delta จิ๋วจาก layout = ไม่สน)
      if (scrollDelta < -minScrollDeltaPx) {
        applyVisible(true, false);
      }
    };

    const handleScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        runScrollLogic();
      });
    };

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollYRef.current = scrollY;
    if (scrollY <= showThresholdPx) applyVisible(true, false);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loadingMore, disableScrollHide, showThresholdPx, hideThresholdPx, minScrollDeltaPx]);

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
