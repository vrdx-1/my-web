'use client';

import React, { useRef, useState, useEffect, startTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Bell, Home, Plus } from 'lucide-react';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { Avatar } from '@/components/Avatar';

// ความสูงขั้นต่ำของ Bottom navigation (ไม่รวม safe-area)
const BOTTOM_NAV_HEIGHT = 72;
// เพิ่ม padding ด้านล่างเพื่อให้ "ความสูงที่มองเห็น" เพิ่มขึ้นจริง
const BOTTOM_NAV_PADDING_BOTTOM_EXTRA = 12;
const BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA = BOTTOM_NAV_HEIGHT + BOTTOM_NAV_PADDING_BOTTOM_EXTRA;

// ขนาดองค์ประกอบใน BottomNav (ให้สมดุลกันทุกปุ่ม)
const NAV_ICON_SIZE = 28;
const NAV_BUTTON_MIN_HEIGHT = 44;
const NAV_BUTTON_PADDING_Y = 6; // ใช้เป็น padding top/bottom
// วงกลมขอบโปรไฟล์: เท่ากับขนาดรูป + เผื่อ border 2px ด้านละ 1 ฝั่ง
const NAV_PROFILE_RING_SIZE = NAV_ICON_SIZE + 4;
const NAV_ICON_SHIFT_UP_PX = -3;

const routes = [
  { path: '/home', label: 'ໜ້າຫຼັກ', match: (p: string) => p === '/home' },
  { path: '/create-post', label: 'ໂພສ', match: (p: string) => p === '/create-post' },
  { path: '/notification', label: 'ການແຈ້ງເຕືອນ', match: (p: string) => p === '/notification' },
  { path: '/profile', label: 'ໂປຣຟາຍ', match: (p: string) => p === '/profile' || p.startsWith('/profile/') },
] as const;

const NAV_DEBOUNCE_MS = 400;

const CREATE_POST_DEBOUNCE_MS = 400;

const LAST_HOME_URL_KEY = 'mainTab_lastHomeUrl';

// ไอคอนการแจ้งเตือน: ใช้แบบใหม่คงที่

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
    if (arrived) {
      // Delay to avoid synchronous setState inside effect (eslint rule)
      setTimeout(() => setPendingPath(null), 0);
    }
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
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_PADDING_BOTTOM_EXTRA}px)`,
      }}
    >
      {routes.map(({ path, label, match }) => {
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
                justifyContent: 'center',
                gap: '0px',
                background: 'none',
                border: 'none',
                padding: `${NAV_BUTTON_PADDING_Y}px 4px ${NAV_BUTTON_PADDING_Y}px 4px`,
                cursor: 'pointer',
                color: '#65676b',
                touchAction: 'manipulation',
                minWidth: 0,
                minHeight: NAV_BUTTON_MIN_HEIGHT,
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: NAV_ICON_SIZE,
                  height: NAV_ICON_SIZE,
                  transform: `translateY(${NAV_ICON_SHIFT_UP_PX}px)`,
                  flexShrink: 0,
                }}
              >
                <Plus size={NAV_ICON_SIZE} strokeWidth={2} style={{ flexShrink: 0 }} />
              </span>
            </button>
          );
        }

        const isProfile = path === '/profile';
        const showBadge = path === '/notification' && !!session && unreadCount > 0;
        const isNotificationTab = path === '/notification';

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
            title={isNotificationTab ? 'ไอคอนการแจ้งเตือน' : undefined}
            aria-current={isActive ? 'page' : undefined}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0px',
              background: 'none',
              border: 'none',
              padding: `${NAV_BUTTON_PADDING_Y}px 4px ${NAV_BUTTON_PADDING_Y}px 4px`,
              cursor: 'pointer',
              color: isActive ? '#1877f2' : '#65676b',
              touchAction: 'manipulation',
              minWidth: 0,
              minHeight: NAV_BUTTON_MIN_HEIGHT,
              overflow: 'visible',
            }}
          >
            {isProfile ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `translateY(${NAV_ICON_SHIFT_UP_PX}px)`,
                }}
              >
                <div
                  style={{
                    width: NAV_PROFILE_RING_SIZE,
                    height: NAV_PROFILE_RING_SIZE,
                    borderRadius: 999,
                    border: isActive ? '2px solid #1877f2' : '2px solid transparent',
                    background: isActive ? 'rgba(24, 119, 242, 0.12)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Avatar
                    avatarUrl={
                      session
                        ? userProfile?.avatar_url ??
                          session?.user?.user_metadata?.avatar_url ??
                          session?.user?.user_metadata?.picture
                        : undefined
                    }
                    size={NAV_ICON_SIZE}
                    session={session}
                    useProfileImage
                  />
                </div>
              </div>
            ) : (
              <span
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: NAV_ICON_SIZE,
                  height: NAV_ICON_SIZE,
                  transform: `translateY(${NAV_ICON_SHIFT_UP_PX}px)`,
                }}
              >
                {path === '/home' && (
                  <Home
                    size={NAV_ICON_SIZE}
                    strokeWidth={2}
                    color={isActive ? '#1877f2' : '#65676b'}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      margin: 'auto',
                      zIndex: 1,
                      pointerEvents: 'none',
                      transform: 'translateY(0px)',
                      transition: 'color 0.15s ease-out',
                    }}
                  />
                )}
                {path === '/notification' && (
                  <>
                    <Bell
                      size={NAV_ICON_SIZE}
                      strokeWidth={2}
                      color={isActive ? '#1877f2' : '#65676b'}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        margin: 'auto',
                        zIndex: 1,
                        opacity: 1,
                        transition: 'opacity 0.15s ease-out',
                        pointerEvents: 'none',
                        transform: 'translateY(0px)',
                      }}
                    />
                  </>
                )}
                {showBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -9,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: '#e0245e',
                      border: '1px solid #ffffff',
                      boxShadow: '0 4px 10px rgba(224, 36, 94, 0.25)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '16px',
                      zIndex: 2,
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export const BOTTOM_NAV_HEIGHT_PX = BOTTOM_NAV_HEIGHT;
export const BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX = BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA;
