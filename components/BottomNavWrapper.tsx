'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX } from '@/components/BottomNav';
import { CreatePostHandlerRegistration } from '@/components/CreatePostHandlerRegistration';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';
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
  const headerVisibility = useHeaderVisibilityContext();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (pathname === '/home') {
      document.body.setAttribute('data-page', 'home');
    } else {
      document.body.removeAttribute('data-page');
    }
  }, [pathname]);
  const showNav = shouldShowBottomNav(pathname ?? '');
  // ลงทะเบียน handler ตอนแสดงแถบล่างทุกหน้า (รวมโฮม) เพื่อให้กดปุ่มโพสได้ทันที — ไม่งั้นหน้าโฮมต้องรอ MainTabLayoutClient mount ก่อนถึงจะกดได้
  const needCreatePostHandler = showNav;
  const hideNavWithScroll = showNav && hideBottomNavWithScrollOnPath(pathname ?? '');
  const isNavVisible = hideNavWithScroll ? (headerVisibility?.isHeaderVisible ?? true) : true;

  return (
    <MainTabScrollProvider>
      {needCreatePostHandler && <CreatePostHandlerRegistration />}
      <div className={showNav ? 'bottom-nav-content-padding' : undefined}>
        {children}
      </div>
      {showNav && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            minHeight: BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX,
            zIndex: pathname === '/profile' ? 1001 : 400,
            transform: isNavVisible ? 'translateY(0)' : `translateY(calc(100% + env(safe-area-inset-bottom, 0px) + 20px))`,
            opacity: isNavVisible ? 1 : 0,
            visibility: isNavVisible ? 'visible' : 'hidden',
            transition: 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease-out',
          }}
        >
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX,
                  background: '#fff',
                  borderTop: '1px solid #e4e6eb',
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
