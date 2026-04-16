'use client';

import React, { useRef, useState, useEffect, Suspense, startTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Bell, House, Plus } from 'lucide-react';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import { useHomeRefreshContext } from '@/contexts/HomeRefreshContext';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { Avatar } from '@/components/Avatar';

// ความสูงตัวแถบหลัก (ไม่รวม safe-area) เพิ่มขึ้นอีกเพื่อให้พื้นที่ของแถบล่างใหญ่และโปร่งขึ้น
const BOTTOM_NAV_HEIGHT = 80;
const BOTTOM_NAV_PADDING_BOTTOM_EXTRA_DEFAULT = 0;
const BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA =
  BOTTOM_NAV_HEIGHT + BOTTOM_NAV_PADDING_BOTTOM_EXTRA_DEFAULT;

// -------------------------------------------------------
// HomeUrlSync — บันทึก URL ปัจจุบัน (รวม ?q=) ลง sessionStorage
// แยกออกมาเพราะ useSearchParams() ต้องการ <Suspense> boundary
// WrappedในBottomNav ด้วย <Suspense fallback={null}> ดังนั้นตัวหลักไม่ต้องใช้ Suspense
// -------------------------------------------------------
function HomeUrlSync({ pathname }: { pathname: string | null }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (pathname !== '/home' || typeof window === 'undefined') return;
    const qs = searchParams.toString();
    const homeUrl = qs ? `/home?${qs}` : '/home';
    try {
      window.sessionStorage.setItem(LAST_HOME_URL_KEY, homeUrl);
    } catch {}
  }, [pathname, searchParams]);
  return null;
}

// ขนาดองค์ประกอบใน BottomNav (ขยายขึ้นเล็กน้อยและคงสัดส่วนให้สมดุลกันทุกปุ่ม)
const NAV_ICON_SIZE = 30;
const NAV_PROFILE_AVATAR_SIZE = 28;
const NAV_BUTTON_MIN_HEIGHT = 64;
const NAV_BUTTON_PADDING_TOP = 4;
const NAV_BUTTON_PADDING_BOTTOM = 18;
const NAV_BUTTON_PADDING = `${NAV_BUTTON_PADDING_TOP}px 4px ${NAV_BUTTON_PADDING_BOTTOM}px 4px`;
// วงกลมขอบโปรไฟล์: เท่ากับขนาดรูป + เผื่อ border 2px ด้านละ 1 ฝั่ง
const NAV_PROFILE_RING_SIZE = NAV_PROFILE_AVATAR_SIZE + 4;
const NAV_ICON_SHIFT_UP_PX = -5;
/** ไอคอนแท็บที่ไม่ active — เข้มขึ้นเล็กน้อยจาก #65676b ขนาดไอคอนไม่เปลี่ยน */
const NAV_ICON_INACTIVE = '#2f3238';

const routes = [
  { path: '/home', label: 'ໜ້າຫຼັກ', match: (p: string) => p === '/home' },
  { path: '/create-post', label: 'ໂພສ', match: (p: string) => p === '/create-post' },
  { path: '/notification', label: 'ການແຈ້ງເຕືອນ', match: (p: string) => p === '/notification' },
  { path: '/profile', label: 'ໂປຣຟາຍ', match: (p: string) => p === '/profile' || p.startsWith('/profile/') },
] as const;

const NAV_DEBOUNCE_MS = 400;

const CREATE_POST_DEBOUNCE_MS = 400;

const LAST_HOME_URL_KEY = 'mainTab_lastHomeUrl';

function HomeNavIcon({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <svg
        width={NAV_ICON_SIZE}
        height={NAV_ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          zIndex: 1,
          pointerEvents: 'none',
          transform: 'translateY(0px)',
        }}
      >
        <path
          d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          fill="#1877f2"
          stroke="#1877f2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="9"
          y="12"
          width="6"
          height="7.2"
          rx="0.9"
          fill="#ffffff"
        />
        <path
          d="M7.6 20.9h8.8"
          stroke="#1877f2"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <House
      size={NAV_ICON_SIZE}
      strokeWidth={2.2}
      color={NAV_ICON_INACTIVE}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        margin: 'auto',
        zIndex: 1,
        pointerEvents: 'none',
        transform: 'translateY(0px)',
      }}
    />
  );
}

function BellNavIcon({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <svg
        width={NAV_ICON_SIZE}
        height={NAV_ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
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
      >
        <path
          d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
          fill="#1877f2"
          stroke="#1877f2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.268 21a2 2 0 0 0 3.464 0"
          stroke="#1877f2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <Bell
      size={NAV_ICON_SIZE}
      strokeWidth={2}
      color={NAV_ICON_INACTIVE}
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
  );
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
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

  return (
    <nav
      role="navigation"
      aria-label="Bottom navigation"
      className="bottom-nav-bar"
        style={{
            position: 'relative',
            width: '100%',
            minHeight: BOTTOM_NAV_HEIGHT,
            background: '#ffffff',
            backgroundColor: '#ffffff',
            borderTop: 'none',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-around',
            zIndex: 1,
            boxShadow: 'none',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
                padding: NAV_BUTTON_PADDING,
                cursor: 'pointer',
                color: NAV_ICON_INACTIVE,
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
                <Plus size={NAV_ICON_SIZE} strokeWidth={2.15} style={{ flexShrink: 0 }} />
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
              padding: NAV_BUTTON_PADDING,
              cursor: 'pointer',
              color: isActive ? '#1877f2' : NAV_ICON_INACTIVE,
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
                    // Important: include the border inside the ring size.
                    // Without this, the border grows the ring and leaves a visual gap
                    // between the blue border and the inner avatar image.
                    boxSizing: 'border-box',
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
                    size={NAV_PROFILE_AVATAR_SIZE}
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
                {path === '/home' && <HomeNavIcon isActive={isActive} />}
                {path === '/notification' && (
                  <BellNavIcon isActive={isActive} />
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
      <Suspense fallback={null}>
        <HomeUrlSync pathname={pathname} />
      </Suspense>
    </nav>
  );
}

export const BOTTOM_NAV_HEIGHT_PX = BOTTOM_NAV_HEIGHT;
export const BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA_PX = BOTTOM_NAV_TOTAL_HEIGHT_EXCLUDING_SAFE_AREA;
