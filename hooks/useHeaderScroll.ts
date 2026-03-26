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
/** ระยะเลื่อนนิ้วที่ทำให้ header/nav ขยับครบช่วง (ยิ่งน้อยยิ่งไวตามนิ้ว) */
const HEADER_DRAG_DISTANCE_PX = 120;
/** เมื่อไม่มี scroll event เกินเวลานี้ ให้ snap ไปสถานะสุดท้ายแบบนุ่มนวล */
const DRAG_SETTLE_IDLE_MS = 90;

interface UseHeaderScrollOptions {
  loadingMore?: boolean;
  /** จำนวนโพสในฟีด (เช่น posts.length) — เมื่อเพิ่มโพสจะกัน scroll ปลอมช่วง layout settle */
  feedPostCount?: number;
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
  /** เรียกทันทีใน scroll handler (ไม่รอ re-render) เพื่อให้ header/nav ตามจังหวะเลื่อน */
  onVisibilityChange?: (visible: boolean) => void;
  /** ค่าเลื่อน 0..1 และสถานะกำลังลาก เพื่อให้ header/nav เลื่อนสัมพันธ์นิ้วมือ */
  onMotionChange?: (progress: number, interacting: boolean) => void;
  /** ถ้า ref.current เป็น timestamp และ performance.now() < ref.current จะไม่ซ่อน header (ใช้หลังสลับแท็บโฮมเพื่อกันกระตุก) */
  suppressHideUntilRef?: React.MutableRefObject<number | null>;
  /** ปรับความไวของพฤติกรรมซ่อน/แสดงตามการเลื่อน โดยไม่ต้องแก้ค่าคงที่ทั้งระบบ */
  scrollTuning?: {
    showThresholdPx?: number;
    hideThresholdPx?: number;
    minScrollDeltaPx?: number;
    fastScrollDeltaPx?: number;
    fastMinScrollDeltaPx?: number;
    visibilityThrottleMs?: number;
    layoutSettleIgnoreMs?: number;
    captionToggleIgnoreMs?: number;
    /** ระยะลากนิ้วที่ทำให้เลื่อนเต็มช่วง; ยิ่งมาก = หนืดขึ้น */
    dragDistancePx?: number;
    /** ระยะ idle ก่อน snap สถานะสุดท้าย */
    settleIdleMs?: number;
    /** โปรไฟล์การตอบสนอง gesture ต่อแพลตฟอร์ม */
    motionProfile?: 'auto' | 'ios' | 'android';
  };
}

type MotionProfile = 'auto' | 'ios' | 'android';

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(options?: UseHeaderScrollOptions): UseHeaderScrollReturn {
  const { loadingMore = false, feedPostCount, disableScrollHide = false, onVisibilityChange, onMotionChange, suppressHideUntilRef, scrollTuning } = options ?? {};
  const showThresholdPx = scrollTuning?.showThresholdPx ?? HEADER_SHOW_THRESHOLD_PX;
  const hideThresholdPx = scrollTuning?.hideThresholdPx ?? HEADER_HIDE_THRESHOLD_PX;
  const minScrollDeltaPx = scrollTuning?.minScrollDeltaPx ?? MIN_SCROLL_DELTA_PX;
  const fastScrollDeltaPx = scrollTuning?.fastScrollDeltaPx ?? 26;
  const fastMinScrollDeltaPx = scrollTuning?.fastMinScrollDeltaPx ?? 20;
  const visibilityThrottleMs = scrollTuning?.visibilityThrottleMs ?? VISIBILITY_THROTTLE_MS;
  const layoutSettleIgnoreMs = scrollTuning?.layoutSettleIgnoreMs ?? LAYOUT_SETTLE_IGNORE_MS;
  const captionToggleIgnoreMs = scrollTuning?.captionToggleIgnoreMs ?? CAPTION_TOGGLE_IGNORE_MS;
  const dragDistancePx = scrollTuning?.dragDistancePx ?? HEADER_DRAG_DISTANCE_PX;
  const settleIdleMs = scrollTuning?.settleIdleMs ?? DRAG_SETTLE_IDLE_MS;
  const motionProfile = scrollTuning?.motionProfile ?? 'auto';
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;
  const onMotionChangeRef = useRef(onMotionChange);
  onMotionChangeRef.current = onMotionChange;
  const lastAppliedVisibleRef = useRef(true);
  const throttleUntilRef = useRef(0);
  /** ถึงเวลานี้ก่อนค่อยให้ scroll ควบคุม header/nav อีกครั้ง */
  const ignoreScrollDrivenVisibilityUntilRef = useRef(0);
  const prevLoadingMoreRef = useRef(loadingMore);
  const prevFeedPostCountRef = useRef(feedPostCount);
  const motionProgressRef = useRef(0);
  const settleTimeoutRef = useRef<number | null>(null);
  const refreshRateRef = useRef(60);
  const touchPanActiveRef = useRef(false);
  const touchLastYRef = useRef<number | null>(null);
  const platformProfileRef = useRef<Exclude<MotionProfile, 'auto'>>('android');

  const emitMotion = (progress: number, interacting: boolean) => {
    const clamped = Math.max(0, Math.min(1, progress));
    motionProgressRef.current = clamped;
    onMotionChangeRef.current?.(clamped, interacting);
  };

  const getAdaptiveDragDistancePx = () => {
    const platform = platformProfileRef.current;
    const platformMultiplier = platform === 'ios' ? 1.08 : 0.98;
    // จอ 120Hz จะยิง event ถี่กว่า จึงต้องเพิ่มระยะเลื่อนเล็กน้อยให้รู้สึกใกล้เคียง 60Hz
    const hz = refreshRateRef.current;
    const hzMultiplier = hz >= 100 ? 1.18 : 1;
    return Math.round(dragDistancePx * platformMultiplier * hzMultiplier);
  };

  const getAdaptiveSettleIdleMs = () => {
    const platform = platformProfileRef.current;
    const platformMultiplier = platform === 'ios' ? 1.06 : 0.94;
    const hz = refreshRateRef.current;
    const hzMultiplier = hz >= 100 ? 0.82 : 1;
    return Math.max(56, Math.round(settleIdleMs * platformMultiplier * hzMultiplier));
  };

  const getAdaptiveDeltaThreshold = (baseSlow: number, baseFast: number, isFast: boolean) => {
    const platform = platformProfileRef.current;
    // iOS ให้ไวขึ้นเล็กน้อย, Android เพิ่มกัน jitter เล็กน้อย
    const platformMultiplier = platform === 'ios' ? 0.9 : 1.08;
    const base = isFast ? baseFast : baseSlow;
    return Math.max(4, Math.round(base * platformMultiplier));
  };

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

  const scheduleSettle = () => {
    if (typeof window === 'undefined') return;
    if (settleTimeoutRef.current != null) {
      window.clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = window.setTimeout(() => {
      settleTimeoutRef.current = null;
      const target = motionProgressRef.current >= 0.5 ? 1 : 0;
      emitMotion(target, false);
      applyVisible(target === 0, false);
    }, getAdaptiveSettleIdleMs());
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    let raf1 = 0;
    let raf2 = 0;
    let frameCount = 0;
    let startTime = 0;

    const step = (ts: number) => {
      if (startTime === 0) startTime = ts;
      frameCount += 1;
      if (ts - startTime >= 260) {
        const hz = Math.round((frameCount * 1000) / (ts - startTime));
        refreshRateRef.current = Math.max(45, Math.min(144, hz));
        return;
      }
      raf2 = window.requestAnimationFrame(step);
    };

    raf1 = window.requestAnimationFrame(step);
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (motionProfile !== 'auto') {
      platformProfileRef.current = motionProfile;
      return;
    }
    if (typeof navigator === 'undefined') {
      platformProfileRef.current = 'android';
      return;
    }
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    platformProfileRef.current = isIOS ? 'ios' : 'android';
  }, [motionProfile]);

  /** ปิด scroll-hide แล้วซิงก์ header/nav (context) ให้แสดงก่อน paint — กัน context ค้างจากหน้าก่อนหน้า + กระพริบเฟรมแรก */
  useLayoutEffect(() => {
    if (!disableScrollHide) return;
    lastAppliedVisibleRef.current = true;
    setIsHeaderVisible(true);
    onVisibilityChangeRef.current?.(true);
    emitMotion(0, false);
  }, [disableScrollHide]);

  useEffect(() => {
    if (disableScrollHide) return;
    let rafId: number | null = null;

    const runScrollLogic = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const scrollDelta = currentScrollY - lastY;
      const absDelta = Math.abs(scrollDelta);
      const isFastScroll = absDelta >= fastScrollDeltaPx;
      const activeDeltaThreshold = getAdaptiveDeltaThreshold(
        minScrollDeltaPx,
        fastMinScrollDeltaPx,
        isFastScroll,
      );

      lastScrollYRef.current = currentScrollY;

      if (touchPanActiveRef.current) {
        return;
      }

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
        emitMotion(0, true);
        applyVisible(true, false);
        scheduleSettle();
        return;
      }
      // เลื่อนลงลึกเกิน threshold ค่อยซ่อน (hysteresis ไม่กระตุกที่ขอบ)
      if (currentScrollY >= hideThresholdPx) {
        if (scrollDelta !== 0) {
          const nextProgress = motionProgressRef.current + scrollDelta / getAdaptiveDragDistancePx();
          emitMotion(nextProgress, true);
        }
        if (scrollDelta > activeDeltaThreshold) {
          applyVisible(false, !isFastScroll);
        } else if (scrollDelta < -activeDeltaThreshold) {
          applyVisible(true, false);
        }
        scheduleSettle();
        return;
      }
      // ระหว่าง SHOW–HIDE: เลื่อนขึ้นชัดเจนเท่านั้นค่อยแสดง header (delta จิ๋วจาก layout = ไม่สน)
      if (scrollDelta !== 0) {
        const nextProgress = motionProgressRef.current + scrollDelta / getAdaptiveDragDistancePx();
        emitMotion(nextProgress, true);
      }
      if (scrollDelta < -activeDeltaThreshold) {
        applyVisible(true, false);
      }
      scheduleSettle();
    };

    const handleScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        runScrollLogic();
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchPanActiveRef.current = true;
      touchLastYRef.current = e.touches[0].clientY;
      emitMotion(motionProgressRef.current, true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchPanActiveRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const lastY = touchLastYRef.current;
      if (lastY == null) {
        touchLastYRef.current = t.clientY;
        return;
      }
      const delta = lastY - t.clientY;
      touchLastYRef.current = t.clientY;
      if (Math.abs(delta) < 0.5) return;

      const nextProgress = motionProgressRef.current + delta / getAdaptiveDragDistancePx();
      emitMotion(nextProgress, true);

      if (motionProgressRef.current >= 0.98) {
        applyVisible(false, false);
      } else if (motionProgressRef.current <= 0.02) {
        applyVisible(true, false);
      }
    };

    const handleTouchEnd = () => {
      touchPanActiveRef.current = false;
      touchLastYRef.current = null;
      scheduleSettle();
    };

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollYRef.current = scrollY;
    if (scrollY <= showThresholdPx) {
      emitMotion(0, false);
      applyVisible(true, false);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      if (settleTimeoutRef.current != null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [loadingMore, disableScrollHide, showThresholdPx, hideThresholdPx, minScrollDeltaPx, fastScrollDeltaPx, fastMinScrollDeltaPx, dragDistancePx, settleIdleMs]);

  // เมื่อ disableScrollHide เป็น true ให้ lock header ไว้เสมอ
  const wrappedSetIsHeaderVisible = (visible: boolean) => {
    if (disableScrollHide) {
      // ไม่ให้เปลี่ยนค่า header เมื่อ disableScrollHide เป็น true
      return;
    }
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
    emitMotion(visible ? 0 : 1, false);
  };

  return {
    isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
    lastScrollY: lastScrollYRef.current,
    setIsHeaderVisible: wrappedSetIsHeaderVisible,
  };
}
