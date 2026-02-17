'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const HOME_PATH = '/';
const LAST_HIDDEN_KEY = 'jutpai_last_hidden_ms';
const MAX_INACTIVE_MS = 30 * 60 * 1000; // 30 นาที

/**
 * ถ้ากลับเข้ามาในเว็บภายใน 30 นาที → อยู่หน้าปัจจุบัน
 * ถ้าออกจากเว็บ/เบราว์เซอร์เกิน 30 นาที → กลับมาแล้วเด้งไปหน้า home
 */
export default function RedirectToHomeOnReturn() {
  const pathname = usePathname();
  const router = useRouter();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    const getLastHidden = (): number | null => {
      if (typeof window === 'undefined') return null;
      const raw = window.sessionStorage.getItem(LAST_HIDDEN_KEY);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const setLastHidden = (ts: number) => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage.setItem(LAST_HIDDEN_KEY, String(ts));
      } catch {
        // ignore
      }
    };

    const maybeRedirectHome = () => {
      if (pathname === HOME_PATH || pathname.startsWith('/profile')) return;
      const lastHidden = getLastHidden();
      if (!lastHidden) return;
      const diff = Date.now() - lastHidden;
      if (diff > MAX_INACTIVE_MS) {
        router.push(HOME_PATH);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
        setLastHidden(Date.now());
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        maybeRedirectHome();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        maybeRedirectHome();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [pathname, router]);

  return null;
}
