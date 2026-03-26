'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { endHomeMotionTimer, startHomeMotionTimer } from '@/lib/homeMotionProfiler';

interface HeaderVisibilityContextValue {
  isHeaderVisible: boolean;
  /** แสดง/ซ่อน header พร้อม snap DOM ทันที — ใช้เมื่อ route เปลี่ยนหรือสลับแท็บ ไม่ใช่ระหว่าง scroll */
  snapHeaderVisible: (visible: boolean) => void;
  /** @deprecated ใช้ snapHeaderVisible แทน */
  setHeaderVisible: (visible: boolean) => void;
  headerSlideProgress: number;
  isHeaderInteracting: boolean;
  setHeaderMotion: (progress: number, interacting: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextValue | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const headerSlideProgressRef = useRef(0);
  const isHeaderInteractingRef = useRef(false);
  const motionFrameRef = useRef<number | null>(null);
  const pendingMotionProgressRef = useRef(0);
  const pendingMotionInteractingRef = useRef(false);
  const lastBodyPanActiveRef = useRef<string>('0');
  const headerSurfacesRef = useRef<HTMLElement[]>([]);
  const bottomNavSurfacesRef = useRef<HTMLElement[]>([]);
  const lastSurfacesRefreshAtRef = useRef(0);
  const headerTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());
  const bottomTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());

  const clampProgress = (value: number) => {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  };

  const refreshMotionSurfacesIfNeeded = (force = false) => {
    if (typeof document === 'undefined') return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const stale = now - lastSurfacesRefreshAtRef.current > 1000;

    if (!force && !stale && headerSurfacesRef.current.length > 0 && bottomNavSurfacesRef.current.length > 0) {
      return;
    }

    headerSurfacesRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-header-motion-surface="1"]'),
    );
    bottomNavSurfacesRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-bottom-nav-motion-surface="1"]'),
    );
    lastSurfacesRefreshAtRef.current = now;
  };

  const setTransformIfChanged = (
    element: HTMLElement,
    nextTransform: string,
    cache: WeakMap<HTMLElement, string>,
  ) => {
    const prev = cache.get(element);
    if (prev === nextTransform) return;
    cache.set(element, nextTransform);
    element.style.transform = nextTransform;
  };

  /**
   * เขียน transform ลง DOM ตรงทันที (synchronous, ไม่มี RAF)
   * ใช้สำหรับ: ตามนิ้วระหว่าง scroll/pan — ต้องการ 0-latency ต่อเฟรม
   * ระวัง: อย่าเรียกจาก useState/useEffect (ไม่ใช่ paint phase) เพราะ layout thrash
   */
  const applyMotionToDomSync = (progress: number, interacting: boolean) => {
    if (typeof document === 'undefined') return;
    const motionTimer = startHomeMotionTimer('motion-apply', 'apply-motion-to-dom');
    refreshMotionSurfacesIfNeeded();

    const headerSurfaces = headerSurfacesRef.current;
    const bottomNavSurfaces = bottomNavSurfacesRef.current;

    headerSurfaces.forEach((element) => {
      const transform = `translate3d(0, ${-progress * 100}%, 0)`;
      setTransformIfChanged(element, transform, headerTransformCacheRef.current);
    });

    bottomNavSurfaces.forEach((element) => {
      const shouldHideWithScroll = element.dataset.hideWithScroll === '1';
      const progressPercent = shouldHideWithScroll ? progress * 100 : 0;
      const transform = `translate3d(0, ${progressPercent}%, 0)`;
      setTransformIfChanged(element, transform, bottomTransformCacheRef.current);
    });

    const nextPanActive = interacting ? '1' : '0';
    if (lastBodyPanActiveRef.current !== nextPanActive) {
      lastBodyPanActiveRef.current = nextPanActive;
      document.body?.setAttribute('data-header-pan-active', nextPanActive);
    }
    endHomeMotionTimer(motionTimer, {
      progress,
      interacting,
      headerSurfaceCount: headerSurfaces.length,
      bottomNavSurfaceCount: bottomNavSurfaces.length,
    });
  };

  /**
   * เขียน transform ผ่าน RAF (coalesced) — ใช้เมื่อต้องการ snap พร้อม settle animation
   * เช่น route change, tab switch, scroll settle
   */
  const applyMotionToDom = (progress: number, interacting: boolean) => {
    if (typeof document === 'undefined') return;
    pendingMotionProgressRef.current = progress;
    pendingMotionInteractingRef.current = interacting;
    if (motionFrameRef.current != null) return;

    motionFrameRef.current = requestAnimationFrame(() => {
      motionFrameRef.current = null;
      applyMotionToDomSync(
        pendingMotionProgressRef.current,
        pendingMotionInteractingRef.current,
      );
    });
  };

  /**
   * snapHeaderVisible — snap DOM ทันทีแล้วอัปเดต React state
   * ใช้สำหรับ: route change, tab switch, scroll coordinator
   * ไม่ใช้ระหว่าง scroll เพราะจะ override smooth progress ที่ setHeaderMotion กำลังเขียน
   */
  const snapHeaderVisible = useCallback((visible: boolean) => {
    isHeaderVisibleRef.current = visible;
    setHeaderVisible(visible);
    const progress = visible ? 0 : 1;
    headerSlideProgressRef.current = progress;
    isHeaderInteractingRef.current = false;
    applyMotionToDom(progress, false);
  }, []);

  /** @deprecated ใช้ snapHeaderVisible แทน */
  const setHeaderVisibleStable = snapHeaderVisible;

  const setHeaderMotion = useCallback((progress: number, interacting: boolean) => {
    const clamped = clampProgress(progress);
    const prevProgress = headerSlideProgressRef.current;
    const prevInteracting = isHeaderInteractingRef.current;
    headerSlideProgressRef.current = clamped;
    isHeaderInteractingRef.current = interacting;

    // เขียน DOM ตรงทันที ไม่รอ RAF เพื่อให้ตามนิ้วได้ทุกเฟรม
    // (applyMotionToDomSync จะ early-return ถ้า transform ไม่เปลี่ยน)
    if (Math.abs(clamped - prevProgress) > 0.002 || prevInteracting !== interacting) {
      applyMotionToDomSync(clamped, interacting);
    }

    if (!interacting) {
      const nextVisible = clamped < 0.5;
      if (isHeaderVisibleRef.current !== nextVisible) {
        isHeaderVisibleRef.current = nextVisible;
        setHeaderVisible(nextVisible);
      }
    }
  }, []);

  const value: HeaderVisibilityContextValue = {
    isHeaderVisible,
    snapHeaderVisible,
    setHeaderVisible: setHeaderVisibleStable,
    headerSlideProgress: headerSlideProgressRef.current,
    isHeaderInteracting: isHeaderInteractingRef.current,
    setHeaderMotion,
  };
  return (
    <HeaderVisibilityContext.Provider value={value}>
      {children}
    </HeaderVisibilityContext.Provider>
  );
}

export function useHeaderVisibilityContext() {
  return useContext(HeaderVisibilityContext);
}
