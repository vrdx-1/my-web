'use client';

import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface FeedPageSkeletonFallbackProps {
  /** หัวข้อของหน้า (เช่น ລາຍການທີ່ບັນທຶກ) */
  title: string;
  /** ให้ตรงกับหน้าจริงที่ใช้ TabNavigation แบบ home (จัดกึ่งกลาง) — ถ้าไม่ส่ง แท็บจะกว้างเต็มจอและตำแหน่งไม่ตรงกับ liked */
  tabNavigationClassName?: string;
  /** ตรงกับ PageHeader showDivider (หน้า liked ใช้ false) */
  showHeaderDivider?: boolean;
  /** ตรงกับ FeedSkeleton count ในหน้าจริง (liked ใช้ 3 — ถ้าไม่ตรงความสูง feed เปลี่ยนแล้ว sticky/scroll เพี้ยน) */
  feedSkeletonCount?: number;
}

/**
 * Fallback ตอนโหลดหน้า saved/liked/my-posts — ใช้ Skeleton แทน spinner
 * โครงเหมือนหน้าจริง (Header + แท็บ + FeedSkeleton) เพื่อไม่ให้ซ้ำซ้อนกับ Skeleton ด้านใน
 */
export function FeedPageSkeletonFallback({
  title,
  tabNavigationClassName,
  showHeaderDivider = true,
  feedSkeletonCount,
}: FeedPageSkeletonFallbackProps) {
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
          boxSizing: 'border-box',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: '#ffffff',
          backgroundColor: '#ffffff',
        }}
      >
        <PageHeader title={title} centerTitle onBack={() => {}} showDivider={showHeaderDivider} />
        <TabNavigation
          className={tabNavigationClassName ?? ''}
          tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab="recommend"
          onTabChange={() => {}}
        />
      </div>
      <div style={{ height: LAYOUT_CONSTANTS.HEADER_HEIGHT }} aria-hidden />
      <FeedSkeleton count={feedSkeletonCount} />
    </main>
  );
}
