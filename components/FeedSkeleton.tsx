'use client';

import React from 'react';

const DEFAULT_CARD_COUNT = 4;
const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
  backgroundSize: '200% 100%',
  animation: 'feed-skeleton-shimmer 1.2s ease-in-out infinite',
  borderRadius: 8,
};

interface FeedSkeletonProps {
  /** จำนวนการ์ด skeleton (ค่าเริ่มต้น 4 สำหรับโหลดครั้งแรก, 2 สำหรับโหลดเพิ่มที่ท้าย feed) */
  count?: number;
}

/**
 * Skeleton placeholder — ทุกครั้งที่โหลด feed ใช้ Skeleton (โหลดครั้งแรก + โหลดเพิ่มที่ท้าย)
 */
export const FeedSkeleton = React.memo(function FeedSkeleton({ count = DEFAULT_CARD_COUNT }: FeedSkeletonProps) {
  return (
    <div
      className="feed-skeleton"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes feed-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            borderBottom: '1px solid #e5e5e5',
            padding: '12px 15px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                ...shimmerStyle,
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...shimmerStyle, height: 16, width: '60%', maxWidth: 140 }} />
              <div style={{ ...shimmerStyle, height: 12, width: '45%', maxWidth: 100 }} />
            </div>
          </div>
          <div style={{ ...shimmerStyle, height: 14, width: '100%', marginTop: 4 }} />
          <div style={{ ...shimmerStyle, height: 14, width: '85%' }} />
          <div
            style={{
              ...shimmerStyle,
              width: '100%',
              height: 320,
              marginTop: 8,
              borderRadius: 4,
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 8,
            }}
          >
            {[1, 2, 3].map((j) => (
              <div key={j} style={{ ...shimmerStyle, height: 18, width: 56 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

FeedSkeleton.displayName = 'FeedSkeleton';
