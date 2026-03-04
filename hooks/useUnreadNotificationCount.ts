'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { fetchNotificationFeed } from '@/utils/notificationFeed';

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
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('notification_cleared_posts') : null;
      const clearedMap: Record<string, string> = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      const { list } = await fetchNotificationFeed(userId, clearedMap);

      // นับตัวเลขการแจ้งเตือนแบบใหม่: 1 ต่อ 1 โพสต์ (ไม่บวกตามจำนวนคนที่กด)
      let finalUnread = 0;
      if (typeof window !== 'undefined') {
        const lastOpenedRaw = window.localStorage.getItem('notification_home_last_opened_at');
        if (lastOpenedRaw) {
          const lastOpenedTime = new Date(lastOpenedRaw).getTime();
          if (!Number.isNaN(lastOpenedTime) && lastOpenedTime > 0) {
            // นับเฉพาะโพสต์ที่มีแจ้งเตือนใหม่หลังจากผู้ใช้เคยเข้า "หน้าแจ้งเตือน" ครั้งล่าสุด (1 ต่อโพสต์)
            const postIdsWithNewNotifications = new Set<string>();
            list.forEach((n) => {
              const createdTime = new Date(n.created_at).getTime();
              const count = n.notification_count ?? 0;
              if (createdTime > lastOpenedTime && count > 0) {
                postIdsWithNewNotifications.add(n.post_id);
              }
            });
            finalUnread = postIdsWithNewNotifications.size;
          } else {
            // ถ้าเวลาไม่ถูกต้อง ให้เริ่มนับใหม่ (นับทุกโพสต์ที่มีแจ้งเตือน)
            const postIdsWithNotifications = new Set<string>();
            list.forEach((n) => {
              const count = n.notification_count ?? 0;
              if (count > 0) {
                postIdsWithNotifications.add(n.post_id);
              }
            });
            finalUnread = postIdsWithNotifications.size;
          }
        } else {
          // ยังไม่เคยเข้าไปหน้าแจ้งเตือน → นับทุกโพสต์ที่มีแจ้งเตือน (1 ต่อโพสต์)
          const postIdsWithNotifications = new Set<string>();
          list.forEach((n) => {
            const count = n.notification_count ?? 0;
            if (count > 0) {
              postIdsWithNotifications.add(n.post_id);
            }
          });
          finalUnread = postIdsWithNotifications.size;
        }
      } else {
        // กรณีไม่มี window (SSR) → นับทุกโพสต์ที่มีแจ้งเตือน (1 ต่อโพสต์)
        const postIdsWithNotifications = new Set<string>();
        list.forEach((n) => {
          const count = n.notification_count ?? 0;
          if (count > 0) {
            postIdsWithNotifications.add(n.post_id);
          }
        });
        finalUnread = postIdsWithNotifications.size;
      }

      setUnreadCount(finalUnread);
      setCachedUnreadCount(userId, finalUnread);
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
    setUnreadCount((prev) => (prev === 0 ? getCachedUnreadCount(userId) : prev));
    const runFetch = () => {
      fetchUnreadCount();
    };
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(runFetch, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(runFetch, 800);
    return () => clearTimeout(t);
  }, [userId, fetchUnreadCount]);

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

  // เข้าหรือออกจากหน้าแจ้งเตือน → ลบตัวเลขแจ้งเตือนทันที (ไม่ต้องรอ refresh)
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname ?? null;
    if (pathname === '/notification') {
      setUnreadCount(0);
    } else if (prev === '/notification') {
      setUnreadCount(0);
    }
  }, [pathname]);

  return { unreadCount, refetch: fetchUnreadCount };
}
