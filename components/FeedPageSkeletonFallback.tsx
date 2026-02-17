'use client';

import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface FeedPageSkeletonFallbackProps {
  /** หัวข้อของหน้า (เช่น ລາຍການທີ່ບັນທຶກ) */
  title: string;
}

/**
 * Fallback ตอนโหลดหน้า saved/liked/my-posts — ใช้ Skeleton แทน spinner
 * โครงเหมือนหน้าจริง (Header + แท็บ + FeedSkeleton) เพื่อไม่ให้ซ้ำซ้อนกับ Skeleton ด้านใน
 */
export function FeedPageSkeletonFallback({ title }: FeedPageSkeletonFallbackProps) {
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff' }}>
        <PageHeader title={title} centerTitle onBack={() => {}} />
        <TabNavigation
          tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab="recommend"
          onTabChange={() => {}}
        />
      </div>
      <FeedSkeleton />
    </main>
  );
}
