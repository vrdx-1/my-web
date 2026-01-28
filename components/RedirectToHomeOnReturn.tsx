'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const HOME_PATH = '/';

/**
 * ออกจากเว็บ/เบราว์เซอร์ แล้วกลับเข้ามาใหม่ → อยู่หน้า home เท่านั้น
 */
export default function RedirectToHomeOnReturn() {
  const pathname = usePathname();
  const router = useRouter();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (pathname !== HOME_PATH) {
          router.push(HOME_PATH);
        }
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && pathname !== HOME_PATH) {
        router.push(HOME_PATH);
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
