'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX } from '@/components/BottomNav';
import { CreatePostHandlerRegistration } from '@/components/CreatePostHandlerRegistration';
import { MainTabScrollProvider } from '@/contexts/MainTabScrollContext';
import { useHeaderVisibilityState } from '@/contexts/HeaderVisibilityContext';
import { MOTION_TRANSITIONS } from '@/utils/motionConstants';

const BOTTOM_NAV_PATHS = ['/home', '/notification', '/profile'];

function shouldShowBottomNav(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/profile') return true;
  // หน้าซับใน profile (เช่น ການຕັ້ງຄ່າ) ไม่แสดงแถบล่าง — ไม่ให้บังปุ่มອອກຈາກລະບົບ
  if (pathname.startsWith('/profile/')) return false;
  if (pathname === '/create-post' || pathname.startsWith('/create-post/')) return false;
  return BOTTOM_NAV_PATHS.includes(pathname);
}

/** หน้าโฮม: ซ่อนแถบล่างตาม header ตอนเลื่อนลง — แท็บอื่นแสดงคงที่ */
function hideBottomNavWithScrollOnPath(pathname: string | null): boolean {
  return pathname === '/home';
}

function BottomNavSurface({
  resolvedPathname,
}: {
  resolvedPathname: string;
}) {
  const isHeaderVisible = useHeaderVisibilityState();
  const hideNavWithScroll = hideBottomNavWithScrollOnPath(resolvedPathname);
  const isHidden = hideNavWithScroll && !isHeaderVisible;
  const navTransform = hideNavWithScroll && !isHeaderVisible
    ? 'translateY(calc(100% + env(safe-area-inset-bottom, 0px) + 10px))'
    : 'translateY(0)';
  const navHeight = `calc(${BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      className="bottom-nav-visibility-surface"
      data-home-bottom-nav-motion-surface="1"
      data-hide-with-scroll={hideNavWithScroll ? '1' : '0'}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: navHeight,
        minHeight: navHeight,
        zIndex: resolvedPathname === '/profile' ? 1001 : 400,
        transform: navTransform,
        opacity: 1,
        visibility: 'visible',
        overflow: 'hidden',
        transition: MOTION_TRANSITIONS.HOME_CHROME_TRANSFORM,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        pointerEvents: isHidden ? 'none' : 'auto',
      }}
    >
      <BottomNav />
    </div>
  );
}

export function BottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const resolvedPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const showNav = shouldShowBottomNav(resolvedPathname);
  const bottomNavContentPaddingBottom = `calc(${BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX}px + env(safe-area-inset-bottom, 0px))`;
  // ลงทะเบียน handler ตอนแสดงแถบล่างทุกหน้า (รวมโฮม) เพื่อให้กดปุ่มโพสได้ทันที — ไม่งั้นหน้าโฮมต้องรอ MainTabLayoutClient mount ก่อนถึงจะกดได้
  const needCreatePostHandler = showNav;

  return (
    <MainTabScrollProvider>
      {needCreatePostHandler && <CreatePostHandlerRegistration />}
      <div style={showNav ? { paddingBottom: bottomNavContentPaddingBottom } : undefined}>
        {children}
      </div>
      {showNav && (
        <BottomNavSurface resolvedPathname={resolvedPathname} />
      )}
    </MainTabScrollProvider>
  );
}
