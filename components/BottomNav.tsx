'use client';

import React, { useRef, useState, useEffect, startTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Home, Plus, PenSquare, Bell, User } from 'lucide-react';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { Avatar } from '@/components/Avatar';

const BOTTOM_NAV_HEIGHT = 56;

const routes = [
  { path: '/home', label: 'ໜ້າຫຼັກ', icon: Home, match: (p: string) => p === '/home' },
  { path: '/create-post', label: 'ໂພສ', icon: PenSquare, match: (p: string) => p === '/create-post' },
  { path: '/notification', label: 'ການແຈ້ງເຕືອນ', icon: Bell, match: (p: string) => p === '/notification' },
  { path: '/profile', label: 'ໂປຣຟາຍ', icon: User, match: (p: string) => p === '/profile' || p.startsWith('/profile/') },
] as const;

const NAV_DEBOUNCE_MS = 400;

const CREATE_POST_DEBOUNCE_MS = 400;

const LAST_HOME_URL_KEY = 'mainTab_lastHomeUrl';

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastNavRef = useRef<{ path: string; at: number } | null>(null);
  const lastCreatePostTriggerRef = useRef<number>(0);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const { session, userProfile } = useSessionAndProfile();
  const { unreadCount } = useUnreadNotificationCount({ userId: session?.user?.id });
  const createPostContext = useCreatePostContext();
  const notificationRefreshContext = useNotificationRefreshContext();
  const homeRefreshContext = useHomeRefreshContext();
  const mainTabScroll = useMainTabScroll();

  const effectivePath = pendingPath ?? pathname ?? '';
  const isHome = effectivePath === '/home';
  const isNotificationOrProfile =
    effectivePath === '/notification' || effectivePath === '/profile' || effectivePath.startsWith('/profile/');

  useEffect(() => {
    if (!pendingPath || pathname == null) return;
    const arrived =
      pendingPath === '/profile'
        ? pathname === '/profile' || pathname.startsWith('/profile/')
        : pathname === pendingPath;
    if (arrived) setPendingPath(null);
  }, [pathname, pendingPath]);

  /** บันทึก URL หน้าโฮม (รวม ?q=) เพื่อเมื่อสลับไปหน้าอื่นแล้วกลับมาได้คำค้นและ scroll คืน */
  useEffect(() => {
    if (pathname !== '/home' || typeof window === 'undefined') return;
    const qs = searchParams.toString();
    const homeUrl = qs ? `/home?${qs}` : '/home';
    try {
      window.sessionStorage.setItem(LAST_HOME_URL_KEY, homeUrl);
    } catch {
      // ignore
    }
  }, [pathname, searchParams]);

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
        background: '#ffffff',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e4e6eb',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        zIndex: 400,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
      }}
    >
      {routes.map(({ path, label, icon: Icon, match }) => {
        const isPostSlot = path === '/create-post';
        const isCreatePostButton = isPostSlot && (isHome || isNotificationOrProfile);

        if (isCreatePostButton) {
          const triggerCreatePost = () => {
            const now = Date.now();
            if (now - lastCreatePostTriggerRef.current < CREATE_POST_DEBOUNCE_MS) return;
            lastCreatePostTriggerRef.current = now;
            createPostContext?.trigger();
          };
          return (
            <button
              key="create-post"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                triggerCreatePost();
              }}
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
                padding: '10px 4px 4px 4px',
                cursor: 'pointer',
                color: '#65676b',
                touchAction: 'manipulation',
                minWidth: 0,
                minHeight: 44,
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

        const isProfile = path === '/profile';
        const showBadge = path === '/notification' && !!session && unreadCount > 0;

        const runNav = () => {
          const now = Date.now();
          const last = lastNavRef.current;
          if (last && last.path === path && now - last.at < NAV_DEBOUNCE_MS) return;
          lastNavRef.current = { path, at: now };

          // Guest กดแจ้งเตือนหรือโปรไฟล์ → ไปหน้าลงทะเบียน (ใช้ push เพื่อกดย้อนกลับได้กลับหน้าโฮม)
          if (path === '/notification' && !session) {
            router.push(REGISTER_PATH, { scroll: false });
            return;
          }
          if (path === '/profile' && !session) {
            router.push(REGISTER_PATH, { scroll: false });
            return;
          }
          // อยู่แท็บเดียวกันแล้ว → แค่ refresh (โฮม/แจ้งเตือน) หรือไม่ทำอะไร (โปรไฟล์)
          const isAlreadyOnTarget =
            pathname === path || (path === '/profile' && pathname?.startsWith('/profile'));
          if (isAlreadyOnTarget) {
            if (path === '/notification') {
              notificationRefreshContext?.trigger();
              return;
            }
            if (path === '/home') {
              homeRefreshContext?.trigger();
              return;
            }
            if (path === '/profile') return;
          }
          // สลับไปอีกแท็บ → บันทึก scroll แล้ว navigate
          if (pathname === '/home' || pathname === '/notification' || pathname === '/profile') {
            mainTabScroll?.saveCurrentScroll(pathname);
          }
          setPendingPath(path);
          startTransition(() => {
            // กลับมาโฮม: ใช้ URL ที่บันทึกไว้ (รวม ?q=) เพื่อไม่ล้างคำค้นและจดจำ scroll ได้
            if (path === '/home') {
              let homeUrl = '/home';
              try {
                const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem(LAST_HOME_URL_KEY) : null;
                if (saved && saved.startsWith('/home')) homeUrl = saved;
              } catch {
                // ignore
              }
              router.push(homeUrl, { scroll: false });
            } else {
              router.push(path, { scroll: false });
            }
          });
        };

        const isActive = match(effectivePath);
        return (
          <button
            key={path}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              runNav();
            }}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: '10px 4px 4px 4px',
              cursor: 'pointer',
              color: isActive ? '#1877f2' : '#65676b',
              touchAction: 'manipulation',
              minWidth: 0,
              minHeight: 44,
              overflow: 'visible',
            }}
          >
            {isProfile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Avatar
                  avatarUrl={
                    session
                      ? userProfile?.avatar_url ??
                        session?.user?.user_metadata?.avatar_url ??
                        session?.user?.user_metadata?.picture
                      : undefined
                  }
                  size={28}
                  session={session}
                  useProfileImage
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
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '40%',
                  maxWidth: 48,
                  height: 3,
                  borderRadius: '0 0 3px 3px',
                  background: '#1877f2',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export const BOTTOM_NAV_HEIGHT_PX = BOTTOM_NAV_HEIGHT;
