'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreatePostClick: () => void;
  onNotificationClick: () => void;
  userProfile?: { avatar_url?: string | null } | null;
  session?: any;
  isHeaderVisible: boolean;
  onTabChange?: () => void;
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
  userProfile,
  session,
  isHeaderVisible,
  onTabChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleTabClick = (tab: 'recommend' | 'sold') => {
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
      <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f0f0f0' }}>
        {/* Search Bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '10px 18px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input 
            type="text" 
            placeholder="ຄົ້ນຫາ" 
            value={searchTerm} 
            onChange={(e) => onSearchChange(e.target.value)} 
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px' }} 
          />
        </div>

        {/* Create Post Button */}
        <button 
          onClick={onCreatePostClick} 
          style={{ 
            width: '46px', 
            height: '46px', 
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        {/* Notification Button */}
        <button 
          onClick={onNotificationClick} 
          style={{ 
            width: '46px', 
            height: '46px', 
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>

        {/* Profile Avatar */}
        <Link href="/profile" style={{ cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation', display: 'block', textDecoration: 'none' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={session ? "#1877f2" : "#8a8a8a"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', minHeight: '44px' }}>
        {(['recommend', 'sold'] as const).map((t) => {
          const isActive = (t === 'recommend' && pathname === '/') || (t === 'sold' && pathname === '/sold');
          return (
            <div
              key={t}
              onClick={() => handleTabClick(t)}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '12px 15px 10px 15px',
                color: isActive ? '#1877f2' : '#65676b',
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
                <span style={{ fontSize: '17px', lineHeight: 1.25 }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</span>
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
