'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  endHomeMotionTimer,
  recordHomeMotionDuration,
  startHomeMotionTimer,
} from '@/lib/homeMotionProfiler';

const TOP_SHOW_THRESHOLD_PX = 24;
const MIN_SCROLL_DELTA_PX = 6;
const CAPTION_TOGGLE_SUPPRESS_MS = 360;
const USER_SCROLL_INTENT_WINDOW_MS = 900;
const HIDE_ACCUMULATED_DELTA_PX = 26;
const SHOW_ACCUMULATED_DELTA_PX = 14;
const VISIBILITY_TOGGLE_COOLDOWN_MS = 170;

interface UseHeaderScrollOptions {
  /** ถ้า true จะไม่ซ่อน/แสดง header ตามการ scroll */
  disableScrollHide?: boolean;
  /** ถ้า true จะซ่อน header เมื่อเลื่อนขึ้น และแสดงเมื่อเลื่อนลง */
  hideOnScrollUp?: boolean;
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
  const {
    disableScrollHide = false,
    hideOnScrollUp = false,
    onVisibilityChange,
    suppressHideUntilRef,
  } = options ?? {};
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const latestScrollYRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const captionToggleSuppressUntilRef = useRef<number>(0);
  const userScrollIntentUntilRef = useRef<number>(0);
  const accumulatedScrollDeltaRef = useRef(0);
  const lastDeltaDirectionRef = useRef<1 | -1 | 0>(0);
  const lastVisibilityToggleAtRef = useRef(0);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  const lastAppliedVisibleRef = useRef(true);
  const applyVisible = useCallback((visible: boolean) => {
    if (lastAppliedVisibleRef.current === visible) return;
    lastAppliedVisibleRef.current = visible;
    lastVisibilityToggleAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    accumulatedScrollDeltaRef.current = 0;
    lastDeltaDirectionRef.current = 0;
    recordHomeMotionDuration('motion-apply', visible ? 'header-show' : 'header-hide', 0, {
      source: 'useHeaderScroll',
    });
    setIsHeaderVisible(visible);
    onVisibilityChangeRef.current?.(visible);
  }, []);

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

    const handleCaptionToggle = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      captionToggleSuppressUntilRef.current = now + CAPTION_TOGGLE_SUPPRESS_MS;
    };

    const markUserScrollIntent = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      userScrollIntentUntilRef.current = now + USER_SCROLL_INTENT_WINDOW_MS;
    };

    window.addEventListener('postcard:caption-toggle', handleCaptionToggle as EventListener);
    // Use touchstart instead of touchmove to avoid ref writes on every finger-move frame.
    window.addEventListener('touchstart', markUserScrollIntent, { passive: true });
    window.addEventListener('wheel', markUserScrollIntent, { passive: true });
    window.addEventListener('keydown', markUserScrollIntent);

    const handleScroll = () => {
      latestScrollYRef.current = Math.max(window.scrollY, 0);
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const timer = startHomeMotionTimer('scroll-handler', 'header-scroll-frame');
        const currentScrollY = latestScrollYRef.current;
        const previousScrollY = lastScrollYRef.current;
        const scrollDelta = currentScrollY - previousScrollY;
        lastScrollYRef.current = currentScrollY;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (scrollDelta === 0) {
          endHomeMotionTimer(timer, {
            action: 'ignore-zero-delta',
            currentScrollY,
            scrollDelta,
          });
          return;
        }

        const captionToggleActive =
          typeof document !== 'undefined' && document.body?.dataset.captionToggleActive === 'true';
        if (captionToggleActive || now < captionToggleSuppressUntilRef.current) {
          endHomeMotionTimer(timer, {
            action: 'suppressed-caption-toggle',
            currentScrollY,
            scrollDelta,
          });
          return;
        }

        if (currentScrollY <= TOP_SHOW_THRESHOLD_PX) {
          applyVisible(true);
          accumulatedScrollDeltaRef.current = 0;
          lastDeltaDirectionRef.current = 0;
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

        const isHideDelta = hideOnScrollUp ? scrollDelta < 0 : scrollDelta > 0;
        if (isHideDelta) {
          const hasUserIntent = now < userScrollIntentUntilRef.current;
          if (!hasUserIntent) {
            endHomeMotionTimer(timer, {
              action: 'suppressed-non-gesture-hide',
              currentScrollY,
              scrollDelta,
            });
            return;
          }
          const hideDirection: 1 | -1 = hideOnScrollUp ? -1 : 1;
          if (lastDeltaDirectionRef.current !== hideDirection) {
            accumulatedScrollDeltaRef.current = 0;
            lastDeltaDirectionRef.current = hideDirection;
          }
          accumulatedScrollDeltaRef.current += Math.abs(scrollDelta);

          const inCooldown = now - lastVisibilityToggleAtRef.current < VISIBILITY_TOGGLE_COOLDOWN_MS;
          if (inCooldown) {
            endHomeMotionTimer(timer, {
              action: 'suppressed-hide-cooldown',
              currentScrollY,
              scrollDelta,
            });
            return;
          }
          if (suppressHideUntilRef?.current != null && now < suppressHideUntilRef.current) {
            endHomeMotionTimer(timer, {
              action: 'suppressed-hide',
              currentScrollY,
              scrollDelta,
            });
            return;
          }
          if (accumulatedScrollDeltaRef.current < HIDE_ACCUMULATED_DELTA_PX) {
            endHomeMotionTimer(timer, {
              action: 'accumulating-hide-threshold',
              currentScrollY,
              scrollDelta,
              accumulated: accumulatedScrollDeltaRef.current,
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

        const showDirection: 1 | -1 = hideOnScrollUp ? 1 : -1;
        if (lastDeltaDirectionRef.current !== showDirection) {
          accumulatedScrollDeltaRef.current = 0;
          lastDeltaDirectionRef.current = showDirection;
        }
        accumulatedScrollDeltaRef.current += Math.abs(scrollDelta);

        const inCooldown = now - lastVisibilityToggleAtRef.current < VISIBILITY_TOGGLE_COOLDOWN_MS;
        if (inCooldown) {
          endHomeMotionTimer(timer, {
            action: 'suppressed-show-cooldown',
            currentScrollY,
            scrollDelta,
          });
          return;
        }
        if (accumulatedScrollDeltaRef.current < SHOW_ACCUMULATED_DELTA_PX) {
          endHomeMotionTimer(timer, {
            action: 'accumulating-show-threshold',
            currentScrollY,
            scrollDelta,
            accumulated: accumulatedScrollDeltaRef.current,
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

    const scrollY = typeof window !== 'undefined' ? Math.max(window.scrollY, 0) : 0;
    lastScrollYRef.current = scrollY;
    latestScrollYRef.current = scrollY;

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      window.removeEventListener('postcard:caption-toggle', handleCaptionToggle as EventListener);
      window.removeEventListener('touchstart', markUserScrollIntent);
      window.removeEventListener('wheel', markUserScrollIntent);
      window.removeEventListener('keydown', markUserScrollIntent);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [applyVisible, disableScrollHide, hideOnScrollUp, suppressHideUntilRef]);

  // เมื่อ disableScrollHide เป็น true ให้ lock header ไว้เสมอ
  const wrappedSetIsHeaderVisible = useCallback((visible: boolean) => {
    if (disableScrollHide) {
      // ไม่ให้เปลี่ยนค่า header เมื่อ disableScrollHide เป็น true
      return;
    }
    applyVisible(visible);
  }, [applyVisible, disableScrollHide]);

  return useMemo(
    () => ({
      isHeaderVisible: disableScrollHide ? true : isHeaderVisible,
      lastScrollY: 0,
      setIsHeaderVisible: wrappedSetIsHeaderVisible,
    }),
    [disableScrollHide, isHeaderVisible, wrappedSetIsHeaderVisible],
  );
}
