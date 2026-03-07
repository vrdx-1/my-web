'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { NotificationSkeleton } from '@/components/NotificationSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { hasRouteVisited } from '@/utils/visitedRoutesStore';

const NOTIFICATION_HEADER_STYLE: React.CSSProperties = {
  padding: '15px',
  borderBottom: '1px solid #f0f0f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'sticky',
  top: 0,
  background: '#ffffff',
  backgroundColor: '#ffffff',
  zIndex: 1000,
  flexShrink: 0,
};

/**
 * หน้ากลางตอนเปลี่ยนเส้นทางภายใน (main) — แสดง skeleton ตาม route
 * ถ้าเคยโหลดหน้านี้แล้ว ไม่แสดง Skeleton (แบบ Facebook)
 */
export default function MainLoading() {
  const pathname = usePathname();
  if (hasRouteVisited(pathname)) return null;

  if (pathname === '/notification') {
    return (
      <main
        style={{
          ...LAYOUT_CONSTANTS.MAIN_CONTAINER,
          fontFamily: LAO_FONT,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={NOTIFICATION_HEADER_STYLE}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', color: '#111111' }}>
            ການແຈ້ງເຕືອນ
          </h1>
        </div>
        <div style={{ flex: 1 }}>
          <NotificationSkeleton count={5} />
        </div>
      </main>
    );
  }

  // อย่าแสดง FeedSkeleton ตอนอยู่ที่ profile หรือกำลังเปลี่ยนจาก profile ไปหน้าอื่น
  // (ช่วงเปลี่ยน pathname อาจยังเป็น /profile ทำให้เคยเห็นหน้าฟีดแทรก)
  if (pathname === '/profile' || pathname?.startsWith('/profile/')) {
    return null;
  }

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <FeedSkeleton count={4} />
    </main>
  );
}
