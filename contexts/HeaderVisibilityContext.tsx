'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface HeaderVisibilityContextValue {
  isHeaderVisible: boolean;
  setHeaderVisible: (visible: boolean) => void;
  headerSlideProgress: number;
  isHeaderInteracting: boolean;
  setHeaderMotion: (progress: number, interacting: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextValue | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const headerSlideProgressRef = useRef(0);
  const isHeaderInteractingRef = useRef(false);

  const clampProgress = (value: number) => {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  };

  const applyMotionToDom = (progress: number, interacting: boolean) => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--home-header-slide-progress', String(progress));
    document.body?.setAttribute('data-header-pan-active', interacting ? '1' : '0');
  };

  const setHeaderVisibleStable = useCallback((visible: boolean) => {
    setHeaderVisible(visible);
    const progress = visible ? 0 : 1;
    headerSlideProgressRef.current = progress;
    isHeaderInteractingRef.current = false;
    applyMotionToDom(progress, false);
  }, []);

  const setHeaderMotion = useCallback((progress: number, interacting: boolean) => {
    const clamped = clampProgress(progress);
    const prevProgress = headerSlideProgressRef.current;
    const prevInteracting = isHeaderInteractingRef.current;
    headerSlideProgressRef.current = clamped;
    isHeaderInteractingRef.current = interacting;

    if (Math.abs(clamped - prevProgress) > 0.002 || prevInteracting !== interacting) {
      applyMotionToDom(clamped, interacting);
    }

    if (!interacting) {
      setHeaderVisible(clamped < 0.5);
    }
  }, []);

  const value: HeaderVisibilityContextValue = {
    isHeaderVisible,
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
