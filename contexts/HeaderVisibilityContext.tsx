'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const HeaderVisibilityStateContext = createContext<boolean>(true);
const HeaderVisibilitySetterContext = createContext<((visible: boolean) => void) | null>(null);

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

  return (
    <HeaderVisibilitySetterContext.Provider value={setHeaderVisible}>
      <HeaderVisibilityStateContext.Provider value={isHeaderVisible}>
        {children}
      </HeaderVisibilityStateContext.Provider>
    </HeaderVisibilitySetterContext.Provider>
  );
}

export function useHeaderVisibilityContext() {
  return {
    isHeaderVisible: useContext(HeaderVisibilityStateContext),
    setHeaderVisible: useContext(HeaderVisibilitySetterContext),
  };
}

export function useHeaderVisibilityState() {
  return useContext(HeaderVisibilityStateContext);
}

export function useSetHeaderVisibility() {
  return useContext(HeaderVisibilitySetterContext);
}
