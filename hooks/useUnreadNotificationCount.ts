'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { fetchNotificationUnreadCount } from '@/utils/notificationFeed';

const UNREAD_COUNT_CACHE_KEY_PREFIX = 'notification_unread_count_cache_';
const UNREAD_COUNT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function getCachedUnreadCount(userId: string | undefined): number {
  if (typeof window === 'undefined' || !userId) return 0;
  try {
    const raw = window.localStorage.getItem(UNREAD_COUNT_CACHE_KEY_PREFIX + userId);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { count?: number; ts?: number };
    if (parsed == null || typeof parsed.count !== 'number') return 0;
    const age = Date.now() - (parsed.ts ?? 0);
    if (age > UNREAD_COUNT_CACHE_MAX_AGE_MS) return 0;
    return parsed.count;
  } catch {
    return 0;
  }
}

function setCachedUnreadCount(userId: string | undefined, count: number): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      UNREAD_COUNT_CACHE_KEY_PREFIX + userId,
      JSON.stringify({ count, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

interface UseUnreadNotificationCountOptions {
  userId: string | undefined;
}

/**
 * Hook สำหรับจัดการการนับ unread notification count
 * นับแบบ 1 ต่อ 1 โพสต์ (ไม่บวกตามจำนวนคนที่กด)
 * แสดงค่าเก่าจาก cache ก่อน แล้วค่อยดึงจริงเมื่อเบราว์เซอร์ว่าง
 */
export function useUnreadNotificationCount({ userId }: UseUnreadNotificationCountOptions) {
  const [unreadCount, setUnreadCount] = useState<number>(() => getCachedUnreadCount(userId));
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await fetchNotificationUnreadCount(userId);
      setUnreadCount(count);
      setCachedUnreadCount(userId, count);
    } catch {
      setUnreadCount(0);
      setCachedUnreadCount(userId, 0);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    if (pathname === '/notification') return;
    setUnreadCount((prev) => (prev === 0 ? getCachedUnreadCount(userId) : prev));
    const runFetch = () => fetchUnreadCount();
    // หน้าโฮม: defer ยาวขึ้นเพื่อให้ฟีดโหลดก่อน ไม่แข่ง network
    const isHome = pathname === '/home' || pathname === '/';
    const timeoutMs = isHome ? 3500 : 2500;
    const delayMs = isHome ? 1500 : 800;
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(runFetch, { timeout: timeoutMs });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(runFetch, delayMs);
    return () => clearTimeout(t);
  }, [userId, pathname, fetchUnreadCount]);

  // Re-fetch when returning to this tab/page
  useEffect(() => {
    if (pathname !== '/') return;
    const onFocus = () => fetchUnreadCount();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnreadCount();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathname, fetchUnreadCount]);

  // เข้าหรือออกจากหน้าแจ้งเตือน → ลบตัวเลขแจ้งเตือนทันที; ออกจากหน้าแล้วค่อยอัปเดต cache เมื่อเครื่องว่าง (ไม่บล็อกการสลับหน้า)
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname ?? null;
    if (pathname === '/notification') {
      setUnreadCount(0);
    } else if (prev === '/notification') {
      setUnreadCount(0);
      const deferRefetch = () => {
        if (userId) fetchUnreadCount();
      };
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(deferRefetch, { timeout: 3000 });
      } else {
        window.setTimeout(deferRefetch, 500);
      }
    }
  }, [pathname, userId, fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
}
