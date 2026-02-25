'use client'

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Poppins } from 'next/font/google';
import { PROFILE_PATH } from '@/utils/authRoutes';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { TabSpinner } from '@/components/LoadingSpinner';
import { Avatar } from '@/components/Avatar';

const poppinsSemiBold = Poppins({
  weight: '600',
  subsets: ['latin'],
  display: 'swap',
});

interface AppHeaderProps {
  onCreatePostClick: () => void;
  onNotificationClick: () => void;
  unreadCount?: number;
  userProfile?: { avatar_url?: string | null } | null;
  session?: any;
  isHeaderVisible: boolean;
  onTabChange?: () => void;
  /** ขนาด icon ด้านใน header (post/notification/profile) */
  iconSize?: number;
  /** ขนาดแท็บ/ปุ่มใน header (post/notification/profile) */
  controlSize?: number;
  /** เรียกเมื่อกดแท็บที่ active อยู่ (refresh) */
  onTabRefresh?: () => void;
  /** เรียกเมื่อกดสลับไปอีกฝั่ง (ก่อน navigate) ให้ parent แสดง loading ทันที */
  onTabSwitchStart?: (tab: 'recommend' | 'sold') => void;
  /** แท็บที่กำลัง refresh แสดง loading เหมือนปุ่มเข้าสู่ระบบ */
  loadingTab?: 'recommend' | 'sold' | null;
  /** เปิด overlay โปรไฟล์ทับ feed (ใช้เมื่ออยู่หน้าโฮม/ขายแล้ว) แทนการ push ไป /profile */
  setProfileOverlayOpen?: (open: boolean) => void;
  /** หน้า Home: แสดงเฉพาะโลโก้ (ซ่อนปุ่มโพสต์/แจ้งเตือน/โปรไฟล์) */
  showOnlySearch?: boolean;
  /** หน้า Home: คอนเทนต์ระหว่างโลโก้กับขอบขวา (ปุ่มค้นหา + ปุ่มฟิลเตอร์) — ใช้เมื่อ showOnlySearch เท่านั้น */
  homeCenterContent?: React.ReactNode;
  /** หน้า Home: ให้ parent เป็นคนสไลด์ (Header + แท็บ) — root ไม่ใช้ fixed/transform */
  slideWithContainer?: boolean;
}

/**
 * AppHeader Component
 * Reusable header component for home and sold pages
 */
export const AppHeader = React.memo<AppHeaderProps>(({
  onCreatePostClick,
  onNotificationClick,
  unreadCount = 0,
  userProfile,
  session,
  isHeaderVisible,
  onTabChange,
  iconSize = 18,
  controlSize = 36,
  onTabRefresh,
  onTabSwitchStart,
  loadingTab = null,
  setProfileOverlayOpen,
  showOnlySearch = false,
  homeCenterContent,
  slideWithContainer = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const onProfileClick = pathname === '/home' && setProfileOverlayOpen
    ? () => setProfileOverlayOpen(true)
    : () => router.push(PROFILE_PATH, { scroll: false });

  // Prevent accidental notification navigation during scroll/drag on touch devices
  const notificationTouchRef = React.useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const NOTIFICATION_TOUCH_MOVE_THRESHOLD = 8;

  const onNotificationTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    const t = e.touches?.[0];
    if (!t) return;
    notificationTouchRef.current = { x: t.clientX, y: t.clientY, moved: false };
  };

  const onNotificationTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    const current = notificationTouchRef.current;
    const t = e.touches?.[0];
    if (!current || !t) return;
    const dx = Math.abs(t.clientX - current.x);
    const dy = Math.abs(t.clientY - current.y);
    if (dx > NOTIFICATION_TOUCH_MOVE_THRESHOLD || dy > NOTIFICATION_TOUCH_MOVE_THRESHOLD) {
      current.moved = true;
    }
  };

  const onNotificationTouchEnd = () => {
    // Keep ref long enough for the synthetic click event to run, then clear.
    window.setTimeout(() => {
      notificationTouchRef.current = null;
    }, 350);
  };

  const onNotificationTouchCancel = () => {
    notificationTouchRef.current = null;
  };

  const handleNotificationClick = () => {
    // If this "click" came from a drag/scroll gesture, ignore it.
    if (notificationTouchRef.current?.moved) {
      notificationTouchRef.current = null;
      return;
    }
    notificationTouchRef.current = null;
    onNotificationClick();
  };

  const handleTabClick = (_tab: 'recommend' | 'sold') => {
    if (pathname === '/home' && onTabRefresh) onTabRefresh();
  };

  const rootStyle = slideWithContainer
    ? {
        width: '100%',
        background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
        backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
      }
    : {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        transform: `translateY(${isHeaderVisible ? '0' : '-100%'})`,
        width: '100%',
        background: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
        backgroundColor: LAYOUT_CONSTANTS.PROFILE_PAGE_BACKGROUND,
        zIndex: 500,
        boxShadow: isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease-out',
      };

  return (
    <div style={rootStyle}>
      <div style={{ 
          padding: '9px 15px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: showOnlySearch && homeCenterContent ? '10px' : '8px', 
          borderBottom: '1px solid #f0f0f0',
        }}>
        {/* Logo (brand name removed per request) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexShrink: 0,
          marginRight: showOnlySearch && homeCenterContent ? '4px' : '8px',
        }}>
          <Image 
            src="https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/WhatsApp%20Image%202026-01-09%20at%2016.10.33%20(1).jpeg" 
            alt="Jutpai Logo" 
            width={LAYOUT_CONSTANTS.HEADER_LOGO_SIZE} 
            height={LAYOUT_CONSTANTS.HEADER_LOGO_SIZE}
            unoptimized
            style={{ flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }}
          />
        </div>

        {showOnlySearch && homeCenterContent ? homeCenterContent : <div style={{ flex: 1, minWidth: 0 }} aria-hidden />}

        {!showOnlySearch && (
          <>
            {/* Create Post Button */}
            <button 
              onClick={onCreatePostClick} 
              style={{ 
                width: `${controlSize}px`, 
                height: `${controlSize}px`, 
                borderRadius: '50%', 
                background: '#e4e6eb', 
                color: '#000', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0, 
                touchAction: 'manipulation' 
              }}
            >
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>

            {/* Notification Button */}
            <button 
              onClick={handleNotificationClick}
              onTouchStart={onNotificationTouchStart}
              onTouchMove={onNotificationTouchMove}
              onTouchEnd={onNotificationTouchEnd}
              onTouchCancel={onNotificationTouchCancel}
              style={{ 
                width: `${controlSize}px`, 
                height: `${controlSize}px`, 
                borderRadius: '50%', 
                background: '#e4e6eb', 
                color: '#000', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0, 
                touchAction: 'manipulation',
                position: 'relative',
              }}
            >
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    background: '#e0245e',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '16px',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </button>

            {/* Profile Avatar — อยู่หน้าโฮม/ขายแล้ว = เปิด overlay สไลด์ทับ feed, นอกนั้น = ไป /profile */}
            <button
              type="button"
              onClick={onProfileClick}
              style={{ cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation', display: 'block', background: 'none', border: 'none', padding: 0 }}
              aria-label="Profile"
            >
              <Avatar
                avatarUrl={
                  session
                    ? userProfile?.avatar_url ??
                      session?.user?.user_metadata?.avatar_url ??
                      session?.user?.user_metadata?.picture
                    : undefined
                }
                size={controlSize}
                session={session}
                useProfileImage
              />
            </button>
          </>
        )}
      </div>

      {/* แท็บ ພ້ອມຂາຍ | ຂາຍແລ້ວ ถูกยกเลิก — เหลือแค่ ຂາຍແລ້ວ */}
    </div>
  );
});

AppHeader.displayName = 'AppHeader';
