'use client';

import { useState, useEffect, useRef } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';

/** Minimum time to show skeleton before revealing content (Facebook-style, avoids flash) */
export const FEED_PRELOAD_MIN_MS = 320;

export interface FeedWithPreloadProps {
  /** เมื่อ true แสดง FeedSkeleton; เมื่อ false รอ FEED_PRELOAD_MIN_MS แล้วค่อยแสดง children พร้อม fade-in */
  showSkeleton: boolean;
  /** จำนวนการ์ด skeleton (ค่าเริ่มต้น 3) */
  skeletonCount?: number;
  children: React.ReactNode;
}

/**
 * ใช้กับ feed ทุกที่ — Preloading & lazy loading แบบ Facebook:
 * แสดง skeleton อย่างน้อย FEED_PRELOAD_MIN_MS ก่อนแสดงเนื้อหา เพื่อไม่ให้กระพริบ
 */
export function FeedWithPreload({
  showSkeleton,
  skeletonCount = 3,
  children,
}: FeedWithPreloadProps) {
  const [preloadMinElapsed, setPreloadMinElapsed] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentReady = !showSkeleton;

  useEffect(() => {
    if (!contentReady) {
      if (minTimerRef.current) {
        clearTimeout(minTimerRef.current);
        minTimerRef.current = null;
      }
      setPreloadMinElapsed(false);
      return;
    }
    minTimerRef.current = setTimeout(() => {
      minTimerRef.current = null;
      setPreloadMinElapsed(true);
    }, FEED_PRELOAD_MIN_MS);
    return () => {
      if (minTimerRef.current) {
        clearTimeout(minTimerRef.current);
        minTimerRef.current = null;
      }
    };
  }, [contentReady]);

  if (showSkeleton) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  if (!preloadMinElapsed) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  return (
    <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
      {children}
    </div>
  );
}
