'use client'

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PROFILE_PATH } from '@/utils/authRoutes';

/**
 * Custom hook สำหรับจัดการ handlers ในหน้า Home
 * แยก logic เพื่อลดความซับซ้อนของ HomeContent
 */
export function useHomeHandlers({
  homeData,
  fileUpload,
  router,
  setIsSearchScreenOpen,
  setTabRefreshing,
  setSearchTerm,
  setRefreshSource,
}: {
  homeData: any;
  fileUpload: any;
  router: any;
  setIsSearchScreenOpen: (open: boolean) => void;
  setTabRefreshing: (refreshing: boolean) => void;
  /** สำหรับ pull-to-refresh: ล้างคำค้นแล้ว refetch เหมือนเข้าเว็บครั้งแรก */
  setSearchTerm?: (v: string) => void;
  setRefreshSource?: (source: 'pull' | 'tab' | null) => void;
}) {
  const handleLogoClick = useCallback(() => {
    homeData.setPage(0);
    homeData.fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [homeData]);

  const handleNotificationClick = useCallback(() => {
    if (!homeData.session) {
      router.push(PROFILE_PATH);
      return;
    }
    router.push('/notification');
  }, [homeData.session, router]);

  const handleCreatePostClick = useCallback(() => {
    fileUpload.handleCreatePostClick(homeData.session);
  }, [fileUpload, homeData.session]);

  const handleSearchClick = useCallback(() => {
    setIsSearchScreenOpen(true);
  }, [setIsSearchScreenOpen]);

  const handleSearchClose = useCallback(() => {
    setIsSearchScreenOpen(false);
  }, [setIsSearchScreenOpen]);

  /** กดแท็บที่ active อยู่ = refresh เฉพาะ feed ของแท็บนี้ (ไม่ล้าง search, ไม่แสดง spinner ใหญ่) */
  const handleTabRefresh = useCallback(() => {
    setRefreshSource?.('tab');
    setTabRefreshing(true);
    handleLogoClick();
  }, [handleLogoClick, setTabRefreshing, setRefreshSource]);

  /** ดึง feed (pull-to-refresh) = refresh ใหญ่: ล้าง search แล้ว refetch, แสดง spinner ใหญ่ */
  const handlePullToRefresh = useCallback(() => {
    setRefreshSource?.('pull');
    setTabRefreshing(true);
    setSearchTerm?.('');
    // เรียก fetchPosts โดยตรงเพื่อให้แน่ใจว่า refresh ทำงานแม้ searchTerm ไม่เปลี่ยน
    homeData.setPage(0);
    homeData.fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchTerm, setTabRefreshing, setRefreshSource, homeData]);

  return {
    handleLogoClick,
    handleNotificationClick,
    handleCreatePostClick,
    handleSearchClick,
    handleSearchClose,
    handleTabRefresh,
    handlePullToRefresh,
  };
}
