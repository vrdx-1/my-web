'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

export type HomeScrollRootContextValue = {
  /** บน iPhone/iPad ใช้กล่องเลื่อนภายใน + ตัดขอบแถบเลื่อน (เหมือน ViewingPostModal) */
  useElementScroll: boolean;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
  boundScrollEl: HTMLDivElement | null;
  setScrollElement: (node: HTMLDivElement | null) => void;
  layoutSpacerPx: number;
};

const HomeScrollRootContext = createContext<HomeScrollRootContextValue | null>(null);

export function HomeScrollRootProvider({ children }: { children: React.ReactNode }) {
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const [boundScrollEl, setBoundScrollEl] = useState<HTMLDivElement | null>(null);
  const [useElementScroll] = useState(() => detectIOS());

  const setScrollElement = useCallback((node: HTMLDivElement | null) => {
    scrollElementRef.current = node;
    setBoundScrollEl(node);
  }, []);

  const value = useMemo(
    () => ({
      useElementScroll,
      scrollElementRef,
      boundScrollEl,
      setScrollElement,
      layoutSpacerPx: LAYOUT_CONSTANTS.HOME_MAIN_TAB_SPACER_PX,
    }),
    [useElementScroll, boundScrollEl, setScrollElement],
  );

  return <HomeScrollRootContext.Provider value={value}>{children}</HomeScrollRootContext.Provider>;
}

export function useHomeScrollRootOptional(): HomeScrollRootContextValue | null {
  return useContext(HomeScrollRootContext);
}
