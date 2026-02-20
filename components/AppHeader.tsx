'use client'

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Poppins } from 'next/font/google';
import { PROFILE_PATH } from '@/utils/authRoutes';
import { TabSpinner } from '@/components/LoadingSpinner';
import { Avatar } from '@/components/Avatar';

const poppinsSemiBold = Poppins({
  weight: '600',
  subsets: ['latin'],
  display: 'swap',
});

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreatePostClick: () => void;
  onNotificationClick: () => void;
  unreadCount?: number;
  userProfile?: { avatar_url?: string | null } | null;
  session?: any;
  isHeaderVisible: boolean;
  onTabChange?: () => void;
  onSearchClick?: () => void;
  /** ขนาด icon ด้านใน header (search/post/notification/profile) */
  iconSize?: number;
  /** ขนาดแท็บ/ปุ่มใน header (search/post/notification/profile) */
  controlSize?: number;
  /** เรียกเมื่อกดแท็บที่ active อยู่ (refresh) */
  onTabRefresh?: () => void;
  /** เรียกเมื่อกดสลับไปอีกฝั่ง (ก่อน navigate) ให้ parent แสดง loading ทันที */
  onTabSwitchStart?: (tab: 'recommend' | 'sold') => void;
  /** แท็บที่กำลัง refresh แสดง loading เหมือนปุ่มเข้าสู่ระบบ */
  loadingTab?: 'recommend' | 'sold' | null;
  /** เปิด overlay โปรไฟล์ทับ feed (ใช้เมื่ออยู่หน้าโฮม/ขายแล้ว) แทนการ push ไป /profile */
  setProfileOverlayOpen?: (open: boolean) => void;
  /** หน้า Home: แสดงเฉพาะ Search (ซ่อนปุ่มโพสต์/แจ้งเตือน/โปรไฟล์) */
  showOnlySearch?: boolean;
}

/**
 * AppHeader Component
 * Reusable header component for home and sold pages
 */
export const AppHeader = React.memo<AppHeaderProps>(({
  searchTerm,
  onSearchChange,
  onCreatePostClick,
  onNotificationClick,
  unreadCount = 0,
  userProfile,
  session,
  isHeaderVisible,
  onTabChange,
  onSearchClick,
  iconSize = 18,
  controlSize = 36,
  onTabRefresh,
  onTabSwitchStart,
  loadingTab = null,
  setProfileOverlayOpen,
  showOnlySearch = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const onProfileClick = (pathname === '/' || pathname === '/sold') && setProfileOverlayOpen
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

  const handleTabClick = (tab: 'recommend' | 'sold') => {
    const isActive = (tab === 'recommend' && pathname === '/') || (tab === 'sold' && pathname === '/sold');
    if (isActive && onTabRefresh) {
      onTabRefresh();
      return;
    }
    onTabSwitchStart?.(tab);
    if (tab === 'recommend') {
      router.push('/');
    } else {
      router.push('/sold');
    }
    if (onTabChange) {
      onTabChange();
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      transform: `translateY(${isHeaderVisible ? '0' : '-100%'})`, 
      width: '100%', 
      background: '#ffffff', 
      backgroundColor: '#ffffff',
      zIndex: 500, 
      boxShadow: isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
      transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease-out'
    }}>
      <div style={{ 
          padding: '9px 15px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          borderBottom: '1px solid #f0f0f0',
        }}>
        {/* Logo and Brand Name */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          flexShrink: 0,
          marginRight: '8px'
        }}>
          <Image 
            src="/images/jutpai-logo.png" 
            alt="Jutpai Logo" 
            width={32} 
            height={32}
            style={{ flexShrink: 0 }}
          />
          <span 
            className={poppinsSemiBold.className}
            style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#2196F3',
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px'
            }}
          >
            Jutpai
          </span>
        </div>
        
        {/* Search Bar */}
        <div 
          onClick={onSearchClick}
          style={{ 
            ...(showOnlySearch ? { maxWidth: '280px', width: '100%', margin: '0 auto' } : { flex: 1 }), 
            display: 'flex', 
            alignItems: 'center', 
            background: '#f0f2f5', 
            borderRadius: '20px', 
            padding: '7px 14px', 
            cursor: 'pointer', 
            minHeight: `${controlSize}px` 
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input 
            type="text" 
            placeholder="ຄົ້ນຫາ" 
            value={searchTerm} 
            onChange={(e) => onSearchChange(e.target.value)} 
            onFocus={onSearchClick}
            onClick={(e) => {
              e.stopPropagation();
              if (onSearchClick) onSearchClick();
            }}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', cursor: 'pointer', color: '#111111' }} 
          />
        </div>

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
              <Avatar avatarUrl={userProfile?.avatar_url} size={controlSize} session={session} />
            </button>
          </>
        )}
      </div>

      {/* Tabs — ใช้ onTouchEnd + preventDefault เพื่อกัน synthetic click ไปโดนโพสต์ด้านล่าง; stopPropagation กัน event ไปที่อื่น */}
      <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid #ddd', minHeight: '36px' }}>
        {(['recommend', 'sold'] as const).map((t) => {
          const isActive = (t === 'recommend' && pathname === '/') || (t === 'sold' && pathname === '/sold');
          const isLoading = loadingTab === t;
          const onTabActivate = (e: React.SyntheticEvent) => {
            e.stopPropagation();
            e.preventDefault();
            handleTabClick(t);
          };
          return (
            <div
              key={t}
              role="tab"
              aria-selected={isActive}
              onTouchEnd={(e) => {
                onTabActivate(e);
              }}
              onClick={(e) => {
                onTabActivate(e);
              }}
              style={{
                flex: 1,
                minHeight: '36px',
                padding: '9px 15px 7px 15px',
                color: isActive ? '#1877f2' : '#4a4d52',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                position: 'relative',
                overflow: 'visible',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'inline-block' }}>
                {isLoading ? (
                  <TabSpinner />
                ) : (
                  <span style={{ fontSize: '14px', lineHeight: 1.25, color: '#111111' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</span>
                )}
              </div>
            </div>
          );
        })}
        {/* เส้นบ่งชี้แท็บที่เลือก — เลื่อนตามแท็บที่ active */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: pathname === '/sold' ? '75%' : '25%',
            width: '28%',
            height: '4px',
            background: '#1877f2',
            borderRadius: '999px',
            transform: 'translateX(-50%)',
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
});

AppHeader.displayName = 'AppHeader';
