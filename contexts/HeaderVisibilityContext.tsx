'use client';

import React, { useContext, useEffect, useSyncExternalStore } from 'react';

type HeaderVisibilityListener = () => void;

const headerVisibilityStore = {
  value: true,
  listeners: new Set<HeaderVisibilityListener>(),
};

const subscribeHeaderVisibility = (listener: HeaderVisibilityListener) => {
  headerVisibilityStore.listeners.add(listener);
  return () => {
    headerVisibilityStore.listeners.delete(listener);
  };
};

const getHeaderVisibilitySnapshot = () => headerVisibilityStore.value;

const setHeaderVisibilityStore = (visible: boolean) => {
  if (headerVisibilityStore.value === visible) return;
  headerVisibilityStore.value = visible;
  headerVisibilityStore.listeners.forEach((listener) => listener());
};

const HeaderVisibilitySetterContext = React.createContext<((visible: boolean) => void) | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
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
    <HeaderVisibilitySetterContext.Provider value={setHeaderVisibilityStore}>
        {children}
    </HeaderVisibilitySetterContext.Provider>
  );
}

export function useHeaderVisibilityContext() {
  return {
    isHeaderVisible: useHeaderVisibilityState(),
    setHeaderVisible: useContext(HeaderVisibilitySetterContext),
  };
}

export function useHeaderVisibilityState() {
  return useSyncExternalStore(
    subscribeHeaderVisibility,
    getHeaderVisibilitySnapshot,
    getHeaderVisibilitySnapshot,
  );
}

export function useSetHeaderVisibility() {
  return useContext(HeaderVisibilitySetterContext);
}
