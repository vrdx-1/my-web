'use client';

import React, { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useHomeScrollRootOptional } from '@/contexts/HomeScrollRootContext';

/** บน iOS แถบเลื่อนของหน้าเว็บทั้งหน้าไม่ซ่อนด้วย CSS — ใช้กล่องเลื่อนภายใน + ตัดขอบขวา (เดียวกับ ViewingPostModal) */
export function HomeScrollShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const homeScroll = useHomeScrollRootOptional();
  const isHome = pathname === '/home';
  const useElementScroll = homeScroll?.useElementScroll ?? false;
  const setScrollElement = homeScroll?.setScrollElement;
  const layoutSpacerPx = homeScroll?.layoutSpacerPx ?? 98;

  useLayoutEffect(() => {
    if (!useElementScroll || !isHome) return;
    document.body.setAttribute('data-ios-home-scroll', 'true');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.removeAttribute('data-ios-home-scroll');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [useElementScroll, isHome]);

  if (!homeScroll || !useElementScroll) {
    return <>{children}</>;
  }

  const innerScroll: React.CSSProperties = {
    width: 'calc(100% + 30px)',
    height: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorY: 'none',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    touchAction: 'pan-y',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        overflow: 'hidden',
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ overflow: 'hidden', width: '100%', height: '100%' }}>
        <div ref={setScrollElement} style={innerScroll}>
          <div style={{ height: layoutSpacerPx, flexShrink: 0 }} aria-hidden />
          {children}
        </div>
      </div>
    </div>
  );
}
