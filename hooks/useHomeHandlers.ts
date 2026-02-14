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
}: {
  homeData: any;
  fileUpload: any;
  router: any;
  setIsSearchScreenOpen: (open: boolean) => void;
  setTabRefreshing: (refreshing: boolean) => void;
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

  const handleTabRefresh = useCallback(() => {
    setTabRefreshing(true);
    handleLogoClick();
  }, [handleLogoClick, setTabRefreshing]);

  return {
    handleLogoClick,
    handleNotificationClick,
    handleCreatePostClick,
    handleSearchClick,
    handleSearchClose,
    handleTabRefresh,
  };
}
