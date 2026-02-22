'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ProfileSlideProvider } from './ProfileSlideContext';
import { useBackHandler } from '@/components/BackHandlerContext';
import { PROFILE_PATH } from '@/utils/authRoutes';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addBackStep } = useBackHandler();

  const requestBack = useCallback(() => {
    router.push('/home');
  }, [router]);

  useEffect(() => {
    if (pathname !== PROFILE_PATH) return;
    const remove = addBackStep(requestBack);
    return remove;
  }, [pathname, addBackStep, requestBack]);

  const isMainProfile = pathname === PROFILE_PATH;
  const isProfileSubPage = pathname?.startsWith('/profile/') && pathname !== PROFILE_PATH;
  // หน้าซับ (ການຕັ້ງຄ່າ ฯลฯ) ไม่มีแถบล่าง — ใช้เต็มจอ ไม่มีอะไรมาบังปุ่มອອກຈາກລະບົບ
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: isProfileSubPage ? 0 : 'calc(72px + env(safe-area-inset-bottom, 0px))',
    background: '#ffffff',
    backgroundColor: '#ffffff',
    zIndex: 1000,
    overflow: isMainProfile ? 'hidden' : 'auto',
  };

  return (
    <ProfileSlideProvider requestBack={requestBack}>
      <div className={isMainProfile ? 'profile-layout-overlay-bottom' : undefined} style={wrapperStyle}>{children}</div>
    </ProfileSlideProvider>
  );
}
