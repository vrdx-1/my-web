'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { TabSpinner } from '@/components/LoadingSpinner';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

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
  /** แท็บที่กำลัง refresh แสดง loading เหมือนปุ่มเข้าสู่ระบบ */
  loadingTab?: 'recommend' | 'sold' | null;
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
  loadingTab = null,
}) => {
  const router = useRouter();
  const pathname = usePathname();

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
      background: '#fff', 
      zIndex: 100, 
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
      boxShadow: isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' 
    }}>
      <div style={{ padding: '9px 15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f0f0f0' }}>
        {/* Search Bar */}
        <div 
          onClick={onSearchClick}
          style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '7px 14px', cursor: 'pointer', minHeight: `${controlSize}px` }}
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

        {/* Profile Avatar */}
        <Link href="/profile" style={{ cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation', display: 'block', textDecoration: 'none' }}>
          <div style={{ width: `${controlSize}px`, height: `${controlSize}px`, borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <GuestAvatarIcon size={iconSize} />
            )}
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', minHeight: '36px' }}>
        {(['recommend', 'sold'] as const).map((t) => {
          const isActive = (t === 'recommend' && pathname === '/') || (t === 'sold' && pathname === '/sold');
          const isLoading = loadingTab === t;
          return (
            <div
              key={t}
              onClick={() => handleTabClick(t)}
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
              }}
            >
              <div style={{ display: 'inline-block', position: 'relative' }}>
                {isLoading ? (
                  <TabSpinner />
                ) : (
                  <span style={{ fontSize: '14px', lineHeight: 1.25, color: '#111111' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</span>
                )}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '200%',
                      height: '4px',
                      background: '#1877f2',
                      borderRadius: '999px',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

AppHeader.displayName = 'AppHeader';
