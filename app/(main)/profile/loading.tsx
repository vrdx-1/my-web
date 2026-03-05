'use client';

import React from 'react';
import { LAO_FONT } from '@/utils/constants';

/**
 * Skeleton หน้าโปรไฟล์ — แสดงทันทีที่กดสลับมาโปรไฟล์ ก่อนโหลดเนื้อหาจริง
 * โครงเดียวกับ ProfileContent ตอน loading (แอปโปรไฟล์ ไม่มีปุ่มกลับ)
 */
export default function ProfileLoading() {
  const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
    backgroundSize: '200% 100%',
    animation: 'profile-loading-skeleton-shimmer 1.2s ease-in-out infinite',
    borderRadius: 8,
  };
  return (
    <div
      className="profile-loading-skeleton"
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#ffffff',
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
      }}
      aria-hidden
    >
      <style>{`
        @keyframes profile-loading-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ padding: '20px', paddingTop: '48px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            padding: '15px',
            background: '#e0e0e0',
            borderRadius: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            marginBottom: '25px',
          }}
        >
          <div style={{ width: 75, height: 75, borderRadius: '50%', flexShrink: 0, ...shimmerStyle }} />
          <div style={{ height: 20, flex: 1, maxWidth: 160, borderRadius: 8, ...shimmerStyle }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, height: 52, borderRadius: 12, ...shimmerStyle }} />
          <div style={{ flex: 1, height: 52, borderRadius: 12, ...shimmerStyle }} />
        </div>
        <div style={{ marginTop: '50px', width: '100%', height: 52, borderRadius: 12, ...shimmerStyle }} />
      </div>
    </div>
  );
}
