'use client';

import React from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/**
 * หน้ากลางตอนเปลี่ยนเส้นทางภายใน (main) — แสดง skeleton ทันทีที่กดสลับหน้า
 */
export default function MainLoading() {
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <FeedSkeleton count={4} />
    </main>
  );
}
