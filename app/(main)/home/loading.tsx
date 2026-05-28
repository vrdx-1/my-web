'use client';

import React, { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { hasRouteVisited } from '@/utils/visitedRoutesStore';

/**
 * Skeleton หน้าโฮม — แสดงทันทีที่โหลด, ถ้าเคยเข้าแล้วจะไม่กระพริบ (ใช้ useRef จำ state)
 */
export default function HomeLoading() {
  const pathname = usePathname();
  const shownRef = useRef(false);
  if (hasRouteVisited(pathname)) {
    shownRef.current = true;
    return null;
  }
  if (shownRef.current) return null;
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <FeedSkeleton count={3} />
    </main>
  );
}
