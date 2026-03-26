'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

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
  const didInitSurfacesRef = useRef(false);
  const headerTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());
  const bottomTransformCacheRef = useRef(new WeakMap<HTMLElement, string>());

  const hasDisconnectedSurface = (elements: HTMLElement[]) => elements.some((element) => !element.isConnected);

  const refreshMotionSurfaces = () => {
    if (typeof document === 'undefined') return;
    headerSurfacesRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-header-motion-surface="1"]'),
    );
    bottomNavSurfacesRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-bottom-nav-motion-surface="1"]'),
    );
    didInitSurfacesRef.current = true;
  };

  const nodeMayContainMotionSurface = (node: Node) => {
    if (!(node instanceof Element)) return false;
    return (
      node.matches('[data-home-header-motion-surface="1"], [data-home-bottom-nav-motion-surface="1"]') ||
      node.querySelector('[data-home-header-motion-surface="1"], [data-home-bottom-nav-motion-surface="1"]') != null
    );
  };

  const refreshMotionSurfacesIfNeeded = (force = false) => {
    if (typeof document === 'undefined') return;
    if (
      !force &&
      didInitSurfacesRef.current &&
      !hasDisconnectedSurface(headerSurfacesRef.current) &&
      !hasDisconnectedSurface(bottomNavSurfacesRef.current)
    ) {
      return;
    }

    refreshMotionSurfaces();
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

  const setHeaderVisible = (visible: boolean) => {
    if (isHeaderVisibleRef.current === visible) {
      applyVisibilityToDom(visible);
      return;
    }
    isHeaderVisibleRef.current = visible;
    applyVisibilityToDom(visible);
    setHeaderVisibleState(visible);
  };

  // 1. ทันที mount: ตั้งค่า DOM ให้ถูกต้อง (transitions ยังถูกบล็อกจาก CSS body:not([data-motion-ready]))
  // 2. หลัง double-rAF (initial paint เสร็จ): เปิด transitions
  useEffect(() => {
    // ดึง surfaces และ apply ตำแหน่งเริ่มต้น — ไม่มี animation เพราะ CSS บล็อกอยู่
    refreshMotionSurfaces();

    const visible = isHeaderVisibleRef.current;
    const headerTransform = visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -100%, 0)';
    headerSurfacesRef.current.forEach((el) => {
      headerTransformCacheRef.current.set(el, headerTransform);
      el.style.transform = headerTransform;
    });
    bottomNavSurfacesRef.current.forEach((el) => {
      const t = 'translate3d(0, 0, 0)';
      bottomTransformCacheRef.current.set(el, t);
      el.style.transform = t;
    });

    // เปิด transitions หลัง browser composite เสร็จ (double-rAF = 2 frames ≈ after first paint)
    const id1: number = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        document.body?.setAttribute('data-motion-ready', '1');
      });
    });
    let id2: number;
    const observer = new MutationObserver((mutations) => {
      const shouldRefresh = mutations.some((mutation) => {
        if (mutation.type === 'attributes') {
          return nodeMayContainMotionSurface(mutation.target);
        }
        return Array.from(mutation.addedNodes).some(nodeMayContainMotionSurface) ||
          Array.from(mutation.removedNodes).some(nodeMayContainMotionSurface);
      });
      if (!shouldRefresh) return;
      refreshMotionSurfaces();
      applyVisibilityToDom(isHeaderVisibleRef.current);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-hide-with-scroll', 'data-home-header-motion-surface', 'data-home-bottom-nav-motion-surface'],
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
