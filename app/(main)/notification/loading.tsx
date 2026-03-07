'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { NotificationSkeleton } from '@/components/NotificationSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { hasRouteVisited } from '@/utils/visitedRoutesStore';

const HEADER_STYLE: React.CSSProperties = {
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
 * Skeleton หน้าการแจ้งเตือน — แสดงเฉพาะโหลดครั้งแรก ถ้าเคยโหลดแล้วไม่แสดง (แบบ Facebook)
 */
export default function NotificationLoading() {
  const pathname = usePathname();
  if (hasRouteVisited(pathname)) return null;
  return (
    <main
      style={{
        background: '#ffffff',
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: LAO_FONT,
      }}
    >
      <div style={HEADER_STYLE}>
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
