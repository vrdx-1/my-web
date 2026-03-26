'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  endHomeMotionTimer,
  markHomeMotionEvent,
  recordHomeMotionDuration,
  startHomeMotionTimer,
} from '@/lib/homeMotionProfiler';

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
type MotionPlatformTier = 'desktop' | 'mobile-normal' | 'mobile-low-end';

interface ResolvedMotionTuning {
  showThresholdPx: number;
  hideThresholdPx: number;
  minScrollDeltaPx: number;
  fastScrollDeltaPx: number;
  fastMinScrollDeltaPx: number;
  visibilityThrottleMs: number;
  layoutSettleIgnoreMs: number;
  captionToggleIgnoreMs: number;
  dragDistancePx: number;
  settleIdleMs: number;
}

/** 3 absolute presets — values are explicitly tuned per platform, no runtime multipliers */
const MOTION_PRESETS: Record<MotionPlatformTier, ResolvedMotionTuning> = {
  desktop: {
    showThresholdPx: 96,
    hideThresholdPx: 220,
    minScrollDeltaPx: 10,
    fastScrollDeltaPx: 24,
    fastMinScrollDeltaPx: 16,
    visibilityThrottleMs: 120,
    layoutSettleIgnoreMs: 220,
    captionToggleIgnoreMs: 420,
    dragDistancePx: 112,
    settleIdleMs: 88,
  },
  'mobile-normal': {
    showThresholdPx: 80,
    hideThresholdPx: 180,
    minScrollDeltaPx: 9,
    fastScrollDeltaPx: 20,
    fastMinScrollDeltaPx: 14,
    visibilityThrottleMs: 88,
    layoutSettleIgnoreMs: 160,
    captionToggleIgnoreMs: 320,
    dragDistancePx: 92,
    settleIdleMs: 70,
  },
  'mobile-low-end': {
    showThresholdPx: 72,
    hideThresholdPx: 160,
    minScrollDeltaPx: 13,
    fastScrollDeltaPx: 20,
    fastMinScrollDeltaPx: 18,
    visibilityThrottleMs: 72,
    layoutSettleIgnoreMs: 200,
    captionToggleIgnoreMs: 380,
    dragDistancePx: 76,
    settleIdleMs: 48,
  },
};

/**
 * Picks the correct preset for the given tier, then layers any explicit call-site
 * overrides on top so individual values can still be tuned without losing the preset baseline.
 */
function resolveMotionTuning(
  callSiteOverrides: Partial<ResolvedMotionTuning>,
  platformTier: MotionPlatformTier,
): ResolvedMotionTuning {
  const preset = MOTION_PRESETS[platformTier];
  return {
    showThresholdPx: callSiteOverrides.showThresholdPx ?? preset.showThresholdPx,
    hideThresholdPx: callSiteOverrides.hideThresholdPx ?? preset.hideThresholdPx,
    minScrollDeltaPx: callSiteOverrides.minScrollDeltaPx ?? preset.minScrollDeltaPx,
    fastScrollDeltaPx: callSiteOverrides.fastScrollDeltaPx ?? preset.fastScrollDeltaPx,
    fastMinScrollDeltaPx: callSiteOverrides.fastMinScrollDeltaPx ?? preset.fastMinScrollDeltaPx,
    visibilityThrottleMs: callSiteOverrides.visibilityThrottleMs ?? preset.visibilityThrottleMs,
    layoutSettleIgnoreMs: callSiteOverrides.layoutSettleIgnoreMs ?? preset.layoutSettleIgnoreMs,
    captionToggleIgnoreMs: callSiteOverrides.captionToggleIgnoreMs ?? preset.captionToggleIgnoreMs,
    dragDistancePx: callSiteOverrides.dragDistancePx ?? preset.dragDistancePx,
    settleIdleMs: callSiteOverrides.settleIdleMs ?? preset.settleIdleMs,
  };
}

function detectPlatformProfile(motionProfile: MotionProfile): Exclude<MotionProfile, 'auto'> {
  if (motionProfile !== 'auto') return motionProfile;
  if (typeof navigator === 'undefined') return 'android';

  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'android';
}

/** Detects which of the 3 tiers this device falls into. */
function detectPlatformTier(motionProfile: MotionProfile): MotionPlatformTier {
  if (typeof navigator === 'undefined') return 'desktop';

  const ua = navigator.userAgent ?? '';
  if (!/Android|iPhone|iPad|iPod/i.test(ua)) return 'desktop';

  const platform = detectPlatformProfile(motionProfile);
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  const isAndroid = platform === 'android';
  const lowCpu = hardwareConcurrency <= (isAndroid ? 6 : 4);
  const lowMemory = deviceMemory <= 4;

  return lowCpu || lowMemory ? 'mobile-low-end' : 'mobile-normal';
}

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(options?: UseHeaderScrollOptions): UseHeaderScrollReturn {
  const { loadingMore = false, feedPostCount, disableScrollHide = false, onVisibilityChange, onMotionChange, suppressHideUntilRef, scrollTuning } = options ?? {};
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
  const platformTierRef = useRef<MotionPlatformTier>('desktop');
  /** EMA of scroll-event inter-arrival gap in ms — drives adaptive interaction window */
  const frameGapEmaRef = useRef<number>(16.7);
  const lastScrollFrameAtRef = useRef<number | null>(null);
  const interactionActiveUntilRef = useRef<number>(0);
  const activePlatformProfile = detectPlatformProfile(motionProfile);
  const activePlatformTier = detectPlatformTier(motionProfile);
  platformProfileRef.current = activePlatformProfile;
  platformTierRef.current = activePlatformTier;

  const callSiteOverrides: Partial<ResolvedMotionTuning> = {
    showThresholdPx: scrollTuning?.showThresholdPx,
    hideThresholdPx: scrollTuning?.hideThresholdPx,
    minScrollDeltaPx: scrollTuning?.minScrollDeltaPx,
    fastScrollDeltaPx: scrollTuning?.fastScrollDeltaPx,
    fastMinScrollDeltaPx: scrollTuning?.fastMinScrollDeltaPx,
    visibilityThrottleMs: scrollTuning?.visibilityThrottleMs,
    layoutSettleIgnoreMs: scrollTuning?.layoutSettleIgnoreMs,
    captionToggleIgnoreMs: scrollTuning?.captionToggleIgnoreMs,
    dragDistancePx: scrollTuning?.dragDistancePx,
    settleIdleMs: scrollTuning?.settleIdleMs,
  };
  const resolvedMotionTuning = resolveMotionTuning(callSiteOverrides, activePlatformTier);
  const showThresholdPx = resolvedMotionTuning.showThresholdPx;
  const hideThresholdPx = resolvedMotionTuning.hideThresholdPx;
  const minScrollDeltaPx = resolvedMotionTuning.minScrollDeltaPx;
  const fastScrollDeltaPx = resolvedMotionTuning.fastScrollDeltaPx;
  const fastMinScrollDeltaPx = resolvedMotionTuning.fastMinScrollDeltaPx;
  const visibilityThrottleMs = resolvedMotionTuning.visibilityThrottleMs;
  const layoutSettleIgnoreMs = resolvedMotionTuning.layoutSettleIgnoreMs;
  const captionToggleIgnoreMs = resolvedMotionTuning.captionToggleIgnoreMs;
  const dragDistancePx = resolvedMotionTuning.dragDistancePx;
  const settleIdleMs = resolvedMotionTuning.settleIdleMs;

  const emitMotion = (progress: number, interacting: boolean) => {
    const clamped = Math.max(0, Math.min(1, progress));
    motionProgressRef.current = clamped;
    onMotionChangeRef.current?.(clamped, interacting);
  };

  const getInteractionWindowMs = () => {
    // window ≈ N frames worth of interaction — adaptive to actual scroll event frequency
    const tier = platformTierRef.current;
    const framesMultiplier = tier === 'mobile-low-end' ? 6 : tier === 'mobile-normal' ? 5 : 4;
    return Math.min(200, Math.max(64, Math.round(frameGapEmaRef.current * framesMultiplier)));
  };

  const bumpInteractionWindow = (now: number) => {
    interactionActiveUntilRef.current = now + getInteractionWindowMs();
  };

  const isInteractionActive = (now: number) => now <= interactionActiveUntilRef.current;

  const getAdaptiveDragDistancePx = () => {
    // จอ 120Hz จะยิง event ถี่กว่า จึงต้องเพิ่มระยะเลื่อนเล็กน้อยให้รู้สึกใกล้เคียง 60Hz
    const hz = refreshRateRef.current;
    const hzMultiplier = hz >= 100 ? 1.18 : 1;
    const tier = platformTierRef.current;
    if (tier === 'desktop') return Math.round(dragDistancePx * hzMultiplier);
    // iOS momentum scroll ปล่อยนิ้วไกลกว่า Android จึงให้ระยะเล็กน้อย
    const platform = platformProfileRef.current;
    const platformMultiplier = platform === 'ios' ? 1.08 : 0.98;
    return Math.round(dragDistancePx * platformMultiplier * hzMultiplier);
  };

  const getAdaptiveSettleIdleMs = () => {
    const tier = platformTierRef.current;
    if (tier === 'desktop') return settleIdleMs;
    const platform = platformProfileRef.current;
    const platformMultiplier = platform === 'ios' ? 1.06 : 0.94;
    const hz = refreshRateRef.current;
    const hzMultiplier = hz >= 100 ? 0.82 : 1;
    return Math.max(32, Math.round(settleIdleMs * platformMultiplier * hzMultiplier));
  };

  const getAdaptiveDeltaThreshold = (baseSlow: number, baseFast: number, isFast: boolean) => {
    const base = isFast ? baseFast : baseSlow;
    const tier = platformTierRef.current;
    if (tier === 'desktop') return base;
    // iOS ให้ไวขึ้นเล็กน้อย, Android เพิ่มกัน jitter เล็กน้อย
    const platform = platformProfileRef.current;
    const platformMultiplier = platform === 'ios' ? 0.9 : 1.08;
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
    if (typeof document === 'undefined') return;
    document.body?.setAttribute('data-home-motion-platform', activePlatformProfile);
    document.body?.setAttribute('data-home-motion-tier', activePlatformTier);
    markHomeMotionEvent('platform-profile-resolved', {
      platform: activePlatformProfile,
      platformTier: activePlatformTier,
      refreshRateHz: refreshRateRef.current,
    });
  }, [activePlatformProfile, activePlatformTier]);

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
      const scrollTimer = startHomeMotionTimer('scroll-handler', 'run-scroll-logic');
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
        endHomeMotionTimer(scrollTimer, { reason: 'touch-pan-active' });
        return;
      }

      // ตอนโหลดเพิ่มหลังมีโพสแล้ว ค่อย ignore scroll-driven visibility เพื่อกัน event ปลอมจาก layout
      // แต่ initial load ของหน้าโฮมต้องยังตอบสนอง gesture/motion ได้ทันทีหลัง refresh
      if (loadingMore && (feedPostCount ?? 0) > 0) {
        endHomeMotionTimer(scrollTimer, { reason: 'loading-more' });
        return;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < ignoreScrollDrivenVisibilityUntilRef.current) {
        endHomeMotionTimer(scrollTimer, { reason: 'layout-settle-ignore' });
        return;
      }

      // During active interaction, keep hot path to transform writes only.
      if (isInteractionActive(now)) {
        if (currentScrollY <= showThresholdPx) {
          emitMotion(0, true);
          scheduleSettle();
          endHomeMotionTimer(scrollTimer, { zone: 'show-interacting', currentScrollY, scrollDelta });
          return;
        }

        if (scrollDelta !== 0) {
          const nextProgress = motionProgressRef.current + scrollDelta / getAdaptiveDragDistancePx();
          emitMotion(nextProgress, true);
        }
        scheduleSettle();
        endHomeMotionTimer(scrollTimer, {
          zone: 'interacting-transform-only',
          currentScrollY,
          scrollDelta,
          activeDeltaThreshold,
          platform: platformProfileRef.current,
          platformTier: platformTierRef.current,
        });
        return;
      }

      // อยู่โซนบนสุดจริง (แสดง header ทันที ไม่ throttle)
      if (currentScrollY <= showThresholdPx) {
        emitMotion(0, false);
        applyVisible(true, false);
        scheduleSettle();
        endHomeMotionTimer(scrollTimer, { zone: 'show', currentScrollY, scrollDelta });
        return;
      }
      // เลื่อนลงลึกเกิน threshold ค่อยซ่อน (hysteresis ไม่กระตุกที่ขอบ)
      if (currentScrollY >= hideThresholdPx) {
        if (scrollDelta !== 0) {
          const nextProgress = motionProgressRef.current + scrollDelta / getAdaptiveDragDistancePx();
          emitMotion(nextProgress, false);
        }
        if (scrollDelta > activeDeltaThreshold) {
          applyVisible(false, !isFastScroll);
        } else if (scrollDelta < -activeDeltaThreshold) {
          applyVisible(true, false);
        }
        scheduleSettle();
        endHomeMotionTimer(scrollTimer, {
          zone: 'hide',
          currentScrollY,
          scrollDelta,
          activeDeltaThreshold,
          platform: platformProfileRef.current,
        });
        return;
      }
      // ระหว่าง SHOW–HIDE: เลื่อนขึ้นชัดเจนเท่านั้นค่อยแสดง header (delta จิ๋วจาก layout = ไม่สน)
      if (scrollDelta !== 0) {
        const nextProgress = motionProgressRef.current + scrollDelta / getAdaptiveDragDistancePx();
        emitMotion(nextProgress, false);
      }
      if (scrollDelta < -activeDeltaThreshold) {
        applyVisible(true, false);
      }
      scheduleSettle();
      endHomeMotionTimer(scrollTimer, {
        zone: 'between',
        currentScrollY,
        scrollDelta,
        activeDeltaThreshold,
        platform: platformProfileRef.current,
      });
    };

    const handleScroll = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      bumpInteractionWindow(now);
      const lastFrameAt = lastScrollFrameAtRef.current;
      if (lastFrameAt != null) {
        const frameGap = now - lastFrameAt;
        // Update EMA of scroll inter-arrival time for adaptive interaction window
        if (frameGap > 4 && frameGap < 500) {
          frameGapEmaRef.current = frameGapEmaRef.current * 0.85 + frameGap * 0.15;
        }
        if (frameGap > 19) {
          recordHomeMotionDuration('frame-gap', 'scroll-frame-gap', frameGap, {
            platform: platformProfileRef.current,
          });
        }
      }
      lastScrollFrameAtRef.current = now;

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
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      bumpInteractionWindow(now);
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

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      bumpInteractionWindow(now);

      const nextProgress = motionProgressRef.current + delta / getAdaptiveDragDistancePx();
      emitMotion(nextProgress, true);
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
  }, [loadingMore, disableScrollHide, showThresholdPx, hideThresholdPx, minScrollDeltaPx, fastScrollDeltaPx, fastMinScrollDeltaPx, dragDistancePx, settleIdleMs, feedPostCount, visibilityThrottleMs, layoutSettleIgnoreMs, captionToggleIgnoreMs]);

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
