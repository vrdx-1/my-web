'use client';

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ProfileSlideProvider } from './ProfileSlideContext';
import { useBackHandler } from '@/components/BackHandlerContext';
import { PROFILE_PATH } from '@/utils/authRoutes';

const SLIDE_DURATION_MS = 300;
const TRANSITION = 'transform 0.3s ease-out';

const PROFILE_NO_SLIDE_KEY = 'profileNoSlide';

/** หน้าเหล่านี้ไม่เล่น slide ตอนเข้า (แสดงทันที) */
function isNoSlidePath(pathname: string): boolean {
  return (
    pathname === '/profile/settings' ||
    pathname.startsWith('/profile/settings/') ||
    pathname === '/profile/edit-profile'
  );
}

/** กลับมาจาก settings/saved/liked/edit-profile → ไม่เล่น slide (ใช้ sessionStorage) */
function shouldSkipSlideFromBack(): boolean {
  if (typeof window === 'undefined') return false;
  return !!sessionStorage.getItem(PROFILE_NO_SLIDE_KEY);
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addBackStep } = useBackHandler();
  const noSlide = isNoSlidePath(pathname);
  /** Initial state ต้องเหมือนกันทั้ง server และ client เพื่อไม่ให้เกิด hydration mismatch (ไม่อ่าน sessionStorage ใน initial) */
  const [phase, setPhase] = useState<'entering' | 'entered' | 'exiting'>(() => {
    if (noSlide) return 'entered';
    return 'entering';
  });
  const [transitionActive, setTransitionActive] = useState(false);
  const isExitingRef = useRef(false);

  const requestBack = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setTransitionActive(true);
    setPhase('exiting');
    const t = setTimeout(() => {
      router.push('/');
      isExitingRef.current = false;
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(t);
  }, [router]);

  useLayoutEffect(() => {
    if (noSlide) return;
    if (pathname === PROFILE_PATH && shouldSkipSlideFromBack()) {
      sessionStorage.removeItem(PROFILE_NO_SLIDE_KEY);
      setPhase('entered');
      setTransitionActive(false);
      return;
    }
    setPhase('entering');
    setTransitionActive(false);
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionActive(true);
        setPhase('entered');
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [noSlide, pathname]);

  useEffect(() => {
    if (phase !== 'entered' || !transitionActive) return;
    const t = setTimeout(() => setTransitionActive(false), 350);
    return () => clearTimeout(t);
  }, [phase, transitionActive]);

  useEffect(() => {
    if (pathname !== PROFILE_PATH) return;
    const remove = addBackStep(requestBack);
    return remove;
  }, [pathname, addBackStep, requestBack]);

  const translateX =
    phase === 'entering' ? '100%' : phase === 'exiting' ? '100%' : '0';
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#fff',
    zIndex: 1000,
    transform: `translateX(${translateX})`,
    transition: transitionActive ? TRANSITION : 'none',
    overflow: 'auto',
  };

  return (
    <ProfileSlideProvider requestBack={requestBack}>
      <div style={wrapperStyle}>{children}</div>
    </ProfileSlideProvider>
  );
}
