'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface HeaderVisibilityContextValue {
  isHeaderVisible: boolean;
  setHeaderVisible: (visible: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextValue | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setHeaderVisibleState] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const headerSurfacesRef = useRef<HTMLElement[]>([]);
  const bottomNavSurfacesRef = useRef<HTMLElement[]>([]);
  const lastSurfacesRefreshAtRef = useRef(0);
  const headerTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());
  const bottomTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());

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

  const applyVisibilityToDom = (visible: boolean) => {
    if (typeof document === 'undefined') return;
    refreshMotionSurfacesIfNeeded();

    const headerSurfaces = headerSurfacesRef.current;
    const bottomNavSurfaces = bottomNavSurfacesRef.current;
    const headerTransform = visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -100%, 0)';

    headerSurfaces.forEach((element) => {
      setTransformIfChanged(element, headerTransform, headerTransformCacheRef.current);
    });

    bottomNavSurfaces.forEach((element) => {
      const shouldHideWithScroll = element.dataset.hideWithScroll === '1';
      const transform = shouldHideWithScroll && !visible
        ? 'translate3d(0, 100%, 0)'
        : 'translate3d(0, 0, 0)';
      setTransformIfChanged(element, transform, bottomTransformCacheRef.current);
    });
  };

  const setHeaderVisible = useCallback((visible: boolean) => {
    if (isHeaderVisibleRef.current === visible) {
      applyVisibilityToDom(visible);
      return;
    }
    isHeaderVisibleRef.current = visible;
    applyVisibilityToDom(visible);
    setHeaderVisibleState(visible);
  }, []);

  const value: HeaderVisibilityContextValue = {
    isHeaderVisible,
    setHeaderVisible,
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
