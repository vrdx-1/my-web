'use client';

import React from 'react';

const DEFAULT_CARD_COUNT = 5;
const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'feed-skeleton-shimmer 1.5s ease-in-out infinite',
  borderRadius: 8,
};

/** โครงเดียวกับ PostCard — header (avatar + ชื่อ/เวลา) + แคปชั่น + รูป + แถบปุ่ม */
const CARD_PADDING = '12px 15px 8px 15px';
const CAPTION_PADDING = '0 15px 8px 15px';

interface FeedSkeletonProps {
  /** จำนวนการ์ด skeleton (ค่าเริ่มต้น 5 สำหรับโหลดครั้งแรก, 1 สำหรับโหลดเพิ่มที่ท้าย feed) */
  count?: number;
  /** ปิด shimmer animation — ลด repaint ตอนเลื่อนเร็วชิดแถวโหลดเพิ่ม (virtual list + scroll) */
  animate?: boolean;
}

/**
 * Skeleton แบบ Facebook — โครงเหมือนโพสจริง (feed-card) ใช้ทั้งโหลดครั้งแรกและโหลดเพิ่มที่ท้าย
 */
export const FeedSkeleton = React.memo(function FeedSkeleton({
  count = DEFAULT_CARD_COUNT,
  animate = true,
}: FeedSkeletonProps) {
  const blockBase = animate
    ? shimmerStyle
    : {
        background: '#e8e8e8',
        backgroundSize: '100% 100%',
        borderRadius: 8,
      };

  return (
    <div
      className="feed-skeleton"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      aria-hidden="true"
    >
      {animate ? (
        <style>{`
        @keyframes feed-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      ) : null}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="feed-card"
          style={{
            borderBottom: '1px solid #c8ccd4',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header — ตรงกับ PostCard postHeader */}
          <div style={{ padding: CARD_PADDING, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div
              style={{
                ...blockBase,
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0, marginTop: '2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...blockBase, height: 18, width: '50%', maxWidth: 140 }} />
              <div style={{ ...blockBase, height: 14, width: '40%', maxWidth: 100 }} />
            </div>
          </div>
          {/* Caption — ตรงกับ caption block */}
          <div style={{ padding: CAPTION_PADDING, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ ...blockBase, height: 15, width: '100%' }} />
            <div style={{ ...blockBase, height: 15, width: '88%' }} />
          </div>
          {/* รูป — ตรงกับ PhotoGrid */}
          <div
            style={{
              ...blockBase,
              width: '100%',
              minHeight: 320,
              margin: '0 15px',
              borderRadius: 4,
            }}
          />
          {/* แถบปุ่ม Like/Comment/Share */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              padding: '10px 15px 16px',
            }}
          >
            {[1, 2, 3].map((j) => (
              <div key={j} style={{ ...blockBase, height: 20, width: 56 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

FeedSkeleton.displayName = 'FeedSkeleton';
