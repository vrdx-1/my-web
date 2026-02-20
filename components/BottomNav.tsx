'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, PenSquare, Bell, User } from 'lucide-react';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { Avatar } from '@/components/Avatar';

const BOTTOM_NAV_HEIGHT = 56;

const routes = [
  { path: '/', label: 'ໜ້າຫຼັກ', icon: Home, match: (p: string) => p === '/' || p === '/sold' },
  { path: '/create-post', label: 'ໂພສ', icon: PenSquare, match: (p: string) => p === '/create-post' },
  { path: '/notification', label: 'ການແຈ້ງເຕືອນ', icon: Bell, match: (p: string) => p === '/notification' },
  { path: '/profile', label: 'ໂປຣຟາຍ', icon: User, match: (p: string) => p === '/profile' || p.startsWith('/profile/') },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount } = useUnreadNotificationCount({ userId: session?.user?.id });
  const createPostContext = useCreatePostContext();
  const notificationRefreshContext = useNotificationRefreshContext();
  const homeRefreshContext = useHomeRefreshContext();

  const isHome = pathname === '/' || pathname === '/sold';
  const isNotificationOrProfile =
    pathname === '/notification' || pathname === '/profile' || (pathname?.startsWith('/profile/') ?? false);

  return (
    <nav
      role="navigation"
      aria-label="Bottom navigation"
      className="bottom-nav-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: BOTTOM_NAV_HEIGHT,
        background: '#fff',
        borderTop: '1px solid #e4e6eb',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        zIndex: 400,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
      }}
    >
      {routes.map(({ path, label, icon: Icon, match }) => {
        const isPostSlot = path === '/create-post';
        const isCreatePostButton = isPostSlot && (isHome || isNotificationOrProfile);

        if (isCreatePostButton) {
          return (
            <button
              key="create-post"
              type="button"
              onClick={() => createPostContext?.trigger()}
              aria-label="ໂພສ"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '4px',
                background: 'none',
                border: 'none',
                padding: '8px 4px 6px 4px',
                cursor: 'pointer',
                color: '#65676b',
                touchAction: 'manipulation',
                minWidth: 0,
              }}
            >
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={28} strokeWidth={2} style={{ flexShrink: 0 }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: '#65676b', lineHeight: 1.2 }}>
                ໂພສ
              </span>
            </button>
          );
        }

        const isActive = match(pathname);
        const isProfile = path === '/profile';
        const showBadge = path === '/notification' && unreadCount > 0;

        const handleClick = (e: React.MouseEvent) => {
          e.preventDefault();
          if (pathname === path && path === '/notification') {
            notificationRefreshContext?.trigger();
            return;
          }
          if (pathname === path && (path === '/sold' || path === '/profile')) {
            return;
          }
          if (path === '/' && (pathname === '/' || pathname === '/sold')) {
            homeRefreshContext?.trigger();
            return;
          }
          router.push(path, { scroll: false });
        };

        return (
          <button
            key={path}
            type="button"
            onClick={handleClick}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: '8px 4px 6px 4px',
              cursor: 'pointer',
              color: isActive ? '#1877f2' : '#65676b',
              touchAction: 'manipulation',
              minWidth: 0,
            }}
          >
            {isProfile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Avatar
                  avatarUrl={userProfile?.avatar_url}
                  size={28}
                  session={session}
                />
              </div>
            ) : (
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon
                  size={28}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ flexShrink: 0 }}
                />
                {showBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: '#e0245e',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '16px',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#1877f2' : '#65676b',
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export const BOTTOM_NAV_HEIGHT_PX = BOTTOM_NAV_HEIGHT;
