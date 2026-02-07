'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useBackHandler } from './BackHandlerContext';

const ROOT_PATH = '/';

/**
 * เมื่อกดย้อนกลับ (browser / โทรศัพท์):
 * - ถ้ามี overlay เปิดอยู่ (fullscreen / viewing mode) → ปิด overlay ตามสเต็ป แล้วดูด back
 * - ถ้าอยู่ที่ root (/) และจะออกจากเว็บ → ดูด back ไม่ให้ออก
 * - นอกนั้น back ตามสเต็ปเหมือนปุ่ม back ในเว็บ
 */
export default function BackHandler() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : ROOT_PATH);
  const initialMountDoneRef = useRef(false);
  const { backStackRef } = useBackHandler();

  useEffect(() => {
    lastPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (initialMountDoneRef.current) return;
    initialMountDoneRef.current = true;

    const onPopState = () => {
      const stack = backStackRef.current;
      if (stack.length > 0) {
        const close = stack.pop();
        if (close) close();
        const url = window.location.pathname + window.location.search + window.location.hash;
        history.pushState({ backHandler: 'overlay-closed' }, '', url);
        return;
      }

      const current = window.location.pathname;
      const last = lastPathnameRef.current;

      if (current === ROOT_PATH && last === ROOT_PATH) {
        history.pushState({ backHandler: 'buffer' }, '', window.location.pathname + window.location.search + window.location.hash);
        lastPathnameRef.current = ROOT_PATH;
        return;
      }

      lastPathnameRef.current = current;
    };

    if (typeof window === 'undefined') return;

    if (pathname === ROOT_PATH) {
      history.pushState({ backHandler: 'buffer' }, '', window.location.pathname + window.location.search + window.location.hash);
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pathname]);

  return null;
}
