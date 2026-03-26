'use client';

import type { UseHomeTabDataReturn } from '@/hooks/useHomeTabData';
import type { UsePostListDataReturn } from '@/hooks/usePostListData';

interface UseHomeEffectivePostListOptions {
  tab: 'recommend' | 'sold';
  tabPostList: UseHomeTabDataReturn['postList'];
  soldListData: UsePostListDataReturn;
  hasSearch: boolean;
}

/**
 * เลือก post list ที่ใช้งาน (recommend vs sold)
 * แทนการ check `isSoldTabNoSearch` ในหลายจุดของ component
 *
 * Logic:
 * - ถ้าอยู่แท็บขาย && ไม่มี search query → ใช้ soldListData
 * - อื่นๆ → ใช้ tabPostList จาก useHomeTabData เพื่อคงพฤติกรรมเดิมทุกเคส
 */
export function useHomeEffectivePostList(
  options: UseHomeEffectivePostListOptions
) {
  const { tab, tabPostList, soldListData, hasSearch } = options;

  const isSoldTabNoSearch = tab === 'sold' && !hasSearch;
  const effectivePostList = isSoldTabNoSearch ? soldListData : tabPostList;

  return {
    isSoldTabNoSearch,
    effectivePostList,
  };
}
