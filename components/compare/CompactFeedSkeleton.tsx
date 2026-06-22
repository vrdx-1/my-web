'use client';

import React from 'react';

interface CompactFeedSkeletonProps {
  count?: number;
  withOuterPadding?: boolean;
}

const COMPACT_IMAGE_SIZE = 98;

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'compact-feed-skeleton-shimmer 1.5s ease-in-out infinite',
};

export const CompactFeedSkeleton = React.memo(function CompactFeedSkeleton({
  count = 3,
  withOuterPadding = true,
}: CompactFeedSkeletonProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: withOuterPadding ? '12px 12px 0' : 0,
        width: '100%',
        boxSizing: 'border-box',
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes compact-feed-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e7edf5',
            boxShadow: '0 14px 28px rgba(15, 23, 42, 0.06)',
            padding: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div
              style={{
                width: COMPACT_IMAGE_SIZE,
                height: COMPACT_IMAGE_SIZE,
                borderRadius: 18,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: 2,
                background: '#eef2f7',
                border: '1px solid #dbe3ee',
              }}
            >
              <div style={{ ...shimmerStyle, borderRadius: 0 }} />
              <div style={{ ...shimmerStyle, borderRadius: 0 }} />
              <div style={{ ...shimmerStyle, borderRadius: 0 }} />
              <div style={{ ...shimmerStyle, borderRadius: 0 }} />
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: COMPACT_IMAGE_SIZE,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div
                  style={{
                    ...shimmerStyle,
                    height: 36,
                    width: '60%',
                    minWidth: 132,
                    borderRadius: 12,
                  }}
                />
                <div
                  style={{
                    ...shimmerStyle,
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingBottom: 1 }}>
                <div style={{ ...shimmerStyle, height: 14, width: '100%', borderRadius: 8 }} />
                <div style={{ ...shimmerStyle, height: 14, width: '92%', borderRadius: 8 }} />
                <div style={{ ...shimmerStyle, height: 14, width: '74%', borderRadius: 8 }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

CompactFeedSkeleton.displayName = 'CompactFeedSkeleton';
