'use client';

import { useState, useEffect, useMemo } from 'react';
import { HOME_FEED_PAGE_SIZE } from '@/utils/constants';

interface UseSearchFeedSliceOptions {
  enabled: boolean;
  /** โพสทั้งหมดจากผลค้นหา (กรอง recommend หรือ sold แล้ว) */
  allPosts: any[];
  /** กำลังโหลดจาก API */
  loading: boolean;
  /** เปลี่ยนเมื่อคำค้น/แท็บ slice เปลี่ยน — รีเซ็ตหน้า */
  queryKey: string;
  /** ต่อหนึ่งครั้งโหลดเพิ่ม — ให้ตรงกับหน้าโฮมปกติ */
  pageSize?: number;
}

/**
 * แสดงผลค้นหาแบบเดียวกับฟีดแนะนำ: ค่อยๆ เผยทีละ pageSize จากรายการที่ได้จาก API แล้ว (client-side)
 */
export function useSearchFeedSlice({
  enabled,
  allPosts,
  loading,
  queryKey,
  pageSize = HOME_FEED_PAGE_SIZE,
}: UseSearchFeedSliceOptions) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    setPage(0);
  }, [enabled, queryKey]);

  const { displayPosts, hasMore } = useMemo(() => {
    if (!enabled) {
      return { displayPosts: [] as any[], hasMore: false };
    }
    /** กำลังโหลดรอบแรกและยังไม่มีรายการ — ให้ parent แสดง skeleton */
    if (loading && allPosts.length === 0) {
      return { displayPosts: [] as any[], hasMore: false };
    }
    const n = allPosts.length;
    if (n === 0) {
      return { displayPosts: [] as any[], hasMore: false };
    }
    const totalVisible = Math.min(n, (page + 1) * pageSize);
    return {
      displayPosts: allPosts.slice(0, totalVisible),
      hasMore: totalVisible < n,
    };
  }, [enabled, loading, allPosts, page, pageSize]);

  /** ตรงกับฟีดปกติ: true เฉพาะตอนกำลังยิง search API */
  const loadingMore = enabled && loading;

  return {
    displayPosts,
    hasMore,
    page,
    setPage,
    loadingMore,
  };
}
