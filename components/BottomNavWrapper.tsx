'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CreatePostHandlerRegistration } from '@/components/CreatePostHandlerRegistration';
import { useHeaderVisibilityContext } from '@/contexts/HeaderVisibilityContext';

const BOTTOM_NAV_PATHS = ['/', '/sold', '/notification', '/profile'];

function shouldShowBottomNav(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/profile') return true;
  if (pathname === '/create-post' || pathname.startsWith('/create-post/')) return false;
  return BOTTOM_NAV_PATHS.includes(pathname);
}

function isNotificationOrProfile(pathname: string): boolean {
  return pathname === '/notification' || pathname === '/profile';
}

function isHomeOrSold(pathname: string): boolean {
  return pathname === '/' || pathname === '/sold';
}

export function BottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const headerVisibility = useHeaderVisibilityContext();
  const showNav = shouldShowBottomNav(pathname ?? '');
  const needCreatePostHandler = showNav && isNotificationOrProfile(pathname ?? '');
  const hideNavWithScroll = showNav && isHomeOrSold(pathname ?? '');
  const isNavVisible = hideNavWithScroll ? (headerVisibility?.isHeaderVisible ?? true) : true;

  return (
    <>
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
            minHeight: 56,
            zIndex: 400,
            transform: isNavVisible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <BottomNav />
        </div>
      )}
    </>
  );
}
