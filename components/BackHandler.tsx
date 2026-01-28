'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const ROOT_PATH = '/';

/**
 * เมื่อกดย้อนกลับ (browser / โทรศัพท์):
 * - ถ้าอยู่ที่ root (/) และจะออกจากเว็บ → ดูด back ไม่ให้ออก
 * - นอกนั้น back ตามสเต็ปเหมือนปุ่ม back ในเว็บ
 */
export default function BackHandler() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : ROOT_PATH);
  const initialMountDoneRef = useRef(false);

  useEffect(() => {
    lastPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (initialMountDoneRef.current) return;
    initialMountDoneRef.current = true;

    const onPopState = () => {
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
