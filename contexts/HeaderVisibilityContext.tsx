'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface HeaderVisibilityContextValue {
  isHeaderVisible: boolean;
  setHeaderVisible: (visible: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextValue | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setHeaderVisibleState] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const setHeaderVisible = useCallback((visible: boolean) => {
    if (isHeaderVisibleRef.current === visible) return;
    isHeaderVisibleRef.current = visible;
    setHeaderVisibleState(visible);
  }, []);

  // เปิด transitions หลัง initial paint (double-rAF)
  useEffect(() => {
    const id1: number = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        document.body?.setAttribute('data-motion-ready', '1');
      });
    });
    let id2: number;

    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2!);
    };
  }, []);

  const value: HeaderVisibilityContextValue = useMemo(
    () => ({
      isHeaderVisible,
      setHeaderVisible,
    }),
    [isHeaderVisible, setHeaderVisible],
  );

  return (
    <HeaderVisibilityContext.Provider value={value}>
      {children}
    </HeaderVisibilityContext.Provider>
  );
}

export function useHeaderVisibilityContext() {
  return useContext(HeaderVisibilityContext);
}
