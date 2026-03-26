'use client';

import React, { Suspense, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX } from '@/components/BottomNav';
import { CreatePostHandlerRegistration } from '@/components/CreatePostHandlerRegistration';
import { MainTabScrollProvider } from '@/contexts/MainTabScrollContext';

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

export function BottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = shouldShowBottomNav(pathname ?? '');
  const shouldUseBottomSafeAreaInset = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isiOSDevice = /iPad|iPhone|iPod/.test(ua);
    const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isiOSDevice || isTouchMac;
  }, []);
  const bottomNavContentPaddingBottom = shouldUseBottomSafeAreaInset
    ? `calc(${BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX}px + env(safe-area-inset-bottom, 0px))`
    : `${BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX}px`;
  // ลงทะเบียน handler ตอนแสดงแถบล่างทุกหน้า (รวมโฮม) เพื่อให้กดปุ่มโพสได้ทันที — ไม่งั้นหน้าโฮมต้องรอ MainTabLayoutClient mount ก่อนถึงจะกดได้
  const needCreatePostHandler = showNav;
  const hideNavWithScroll = showNav && hideBottomNavWithScrollOnPath(pathname ?? '');

  return (
    <MainTabScrollProvider>
      {needCreatePostHandler && <CreatePostHandlerRegistration />}
      <div style={showNav ? { paddingBottom: bottomNavContentPaddingBottom } : undefined}>
        {children}
      </div>
      {showNav && (
        <div
          className="bottom-nav-visibility-surface"
          data-home-bottom-nav-motion-surface="1"
          data-hide-with-scroll={hideNavWithScroll ? '1' : '0'}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            minHeight: BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX,
            zIndex: pathname === '/profile' ? 1001 : 400,
            transform: 'translate3d(0, 0, 0)',
            opacity: 1,
            visibility: 'visible',
            transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            contain: 'paint',
          }}
        >
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX,
                  background: '#fff',
                  borderTop: 'none',
                }}
              />
            }
          >
            <BottomNav />
          </Suspense>
        </div>
      )}
    </MainTabScrollProvider>
  );
}
