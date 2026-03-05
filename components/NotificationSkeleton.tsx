'use client';

import React from 'react';

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
  backgroundSize: '200% 100%',
  animation: 'notification-skeleton-shimmer 1.2s ease-in-out infinite',
  borderRadius: 8,
};

interface NotificationSkeletonProps {
  /** จำนวนแถว skeleton (ค่าเริ่มต้น 5 สำหรับโหลดครั้งแรก, 2 สำหรับโหลดเพิ่ม) */
  count?: number;
}

/**
 * Skeleton สำหรับหน้าการแจ้งเตือน — ใช้แทน Loading spinner ทุกครั้งที่โหลด
 */
export const NotificationSkeleton = React.memo(function NotificationSkeleton({
  count = 5,
}: NotificationSkeletonProps) {
  return (
    <div
      className="notification-skeleton"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes notification-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            gap: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {/* Avatar 56x56 ตรงกับ NotificationPostPreviewCard */}
          <div
            style={{
              ...shimmerStyle,
              width: 56,
              height: 56,
              borderRadius: '50%',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            {/* แถวบน: ชื่อ + ແລະອີກ x ຄົນມັກໂພສຂອງທ່ານ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
              <div style={{ ...shimmerStyle, height: 14, width: 56, flexShrink: 0 }} />
              <div style={{ ...shimmerStyle, height: 14, flex: 1, minWidth: 0, maxWidth: 200 }} />
            </div>
            {/* แถวแคปชั่น */}
            <div style={{ ...shimmerStyle, height: 13, width: '85%', maxWidth: 220 }} />
            {/* แถวเวลา */}
            <div style={{ ...shimmerStyle, height: 11, width: 64, marginTop: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
});

NotificationSkeleton.displayName = 'NotificationSkeleton';
