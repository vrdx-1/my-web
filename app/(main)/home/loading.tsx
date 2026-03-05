'use client';

import React from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/**
 * Skeleton หน้าโฮม — แสดงทันทีที่กดสลับมาโฮม ก่อนโหลดเนื้อหาจริง
 */
export default function HomeLoading() {
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <FeedSkeleton count={4} />
    </main>
  );
}
