'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { hasRouteVisited } from '@/utils/visitedRoutesStore';

/**
 * Skeleton หน้าโฮม — แสดงเฉพาะโหลดครั้งแรก ถ้าเคยโหลดแล้วไม่แสดง (แบบ Facebook)
 */
export default function HomeLoading() {
  const pathname = usePathname();
  if (hasRouteVisited(pathname)) return null;
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <FeedSkeleton count={3} />
    </main>
  );
}
