'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchNotificationFeed } from '@/utils/notificationFeed';
import { formatTimeAgo } from '@/utils/formatTime';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { NOTIFICATION_PAGE_SIZE, FEED_PRELOAD_ROOT_MARGIN, FEED_PRELOAD_THRESHOLD } from '@/utils/constants';
import type { NotificationFeedItem } from '@/utils/notificationFeed';
import type { CachedBoosts } from '@/utils/notificationFeed';

const STORAGE_KEY = 'notification_cleared_posts';
const HOME_OPENED_KEY = 'notification_home_last_opened_at';

/** เปิด debug: เปิด Console (F12) พิมพ์ window.__NOTIFICATION_LOADMORE_DEBUG = true แล้วเลื่อนลง จะมี log [notification loadMore] */
function debugLog(...args: unknown[]) {
  if (typeof window !== 'undefined' && (window as any).__NOTIFICATION_LOADMORE_DEBUG) {
    console.log('[notification loadMore]', ...args);
  }
}

function loadClearedMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = new Date().toISOString();
      return (parsed as string[]).reduce<Record<string, string>>((acc, id) => {
        acc[id] = now;
        return acc;
      }, {});
    }
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function saveClearedMap(map: Record<string, string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export interface NotificationItemWithTime extends NotificationFeedItem {
  timeAgoText: string;
}

export function useNotificationPage() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<NotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [clearedPostMap, setClearedPostMap] = useState<Record<string, string>>({});
  const [clearedMapReady, setClearedMapReady] = useState(false);
  const clearedPostMapRef = useRef<Record<string, string>>({});
  const notificationsRef = useRef<NotificationFeedItem[]>([]);
  const boostsCacheRef = useRef<CachedBoosts>(null);
  const userIdRef = useRef<string | null>(null);
  /** Cursor สำหรับหน้าถัดไป = แถวสุดท้ายของ rawFeed ล่าสุด (ไม่ใช้จาก list ที่ merge แล้ว) */
  const lastCursorRef = useRef<{ created_at: string; id: string } | null>(null);

  useEffect(() => {
    const loaded = loadClearedMap();
    setClearedPostMap(loaded);
    clearedPostMapRef.current = loaded;
    setClearedMapReady(true);
  }, []);

  useEffect(() => {
    clearedPostMapRef.current = clearedPostMap;
  }, [clearedPostMap]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const markPageAsRead = useCallback(async (userId: string, rawFeed: any[]) => {
    if (rawFeed.length === 0) return;
    try {
      await supabase
        .from('notification_reads')
        .upsert(
          rawFeed.map((n: { id: string }) => ({ user_id: userId, notification_id: n.id })),
          { onConflict: 'user_id,notification_id' }
        );
    } catch {
      // ignore
    }
  }, []);

  const fetchFirstPage = useCallback(async (userId: string) => {
    userIdRef.current = userId;
    setLoading(true);
    try {
      const result = await fetchNotificationFeed(
        userId,
        clearedPostMapRef.current,
        { limit: NOTIFICATION_PAGE_SIZE, offset: 0 }
      );
      markPageAsRead(userId, result.rawFeed).catch(() => {});
      if (result.boostsForCache) boostsCacheRef.current = result.boostsForCache;
      setNotifications(result.list);
      setHasMore(result.hasMore ?? false);
      const raw = result.rawFeed;
      lastCursorRef.current =
        raw?.length > 0 && raw[raw.length - 1]?.id && raw[raw.length - 1]?.created_at
          ? { created_at: raw[raw.length - 1].created_at, id: raw[raw.length - 1].id }
          : null;
    } catch (err) {
      console.error('Fetch Error:', err);
      setNotifications([]);
      setHasMore(false);
      lastCursorRef.current = null;
    } finally {
      setLoading(false);
      const scrollToTop = () => {
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
        scrollContainerRef.current?.scrollTo(0, 0);
      };
      requestAnimationFrame(() => requestAnimationFrame(scrollToTop));
    }
  }, [markPageAsRead]);

  useEffect(() => {
    if (!clearedMapReady) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        fetchFirstPage(session.user.id).then(() => {
          if (!cancelled && typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(HOME_OPENED_KEY, new Date().toISOString());
            } catch {
              // ignore
            }
          }
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clearedMapReady, fetchFirstPage]);

  const loadMore = useCallback(async () => {
    debugLog('loadMore called', { loadingMore, hasMore });
    if (loadingMore || !hasMore) {
      debugLog('skip: loadingMore=', loadingMore, 'hasMore=', hasMore);
      return;
    }
    const userId = userIdRef.current ?? (await supabase.auth.getSession()).data.session?.user?.id;
    if (!userId) {
      debugLog('skip: no userId');
      return;
    }
    if (!userIdRef.current) userIdRef.current = userId;
    const cursor = lastCursorRef.current ?? undefined;
    debugLog('cursor from last rawFeed', cursor);
    setLoadingMore(true);
    try {
      const result = await fetchNotificationFeed(
        userId,
        clearedPostMapRef.current,
        { limit: NOTIFICATION_PAGE_SIZE, cursor },
        boostsCacheRef.current
      );
      const raw = result.rawFeed;
      if (raw?.length > 0 && raw[raw.length - 1]?.id && raw[raw.length - 1]?.created_at) {
        lastCursorRef.current = { created_at: raw[raw.length - 1].created_at, id: raw[raw.length - 1].id };
      }
      debugLog('API returned', result.list.length, 'items, hasMore=', result.hasMore, 'rawRows=', raw?.length);
      markPageAsRead(userId, raw).catch(() => {});
      if (result.boostsForCache) boostsCacheRef.current = result.boostsForCache;
      setNotifications((prev) => {
        const existingPostIds = new Set(prev.map((n) => String(n.post_id)));
        const toAdd = result.list.filter((n) => !existingPostIds.has(String(n.post_id)));
        debugLog('toAdd', toAdd.length, 'existing', prev.length);
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd];
      });
      setHasMore(result.hasMore ?? false);
    } catch (err) {
      console.error('Load more Error:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, markPageAsRead]);

  // Preloading ระดับสากล — โหลดหน้าถัดไปล่วงหน้า 800px ก่อนถึงล่าง (เหมือน feed)
  const { lastElementRef } = useInfiniteScroll({
    loadingMore,
    hasMore,
    onLoadMore: loadMore,
    threshold: FEED_PRELOAD_THRESHOLD,
    rootMargin: FEED_PRELOAD_ROOT_MARGIN,
    rootRef: scrollContainerRef,
  });

  const visibleItemsWithTime = useMemo<NotificationItemWithTime[]>(
    () =>
      notifications
        .map((n) => ({
          ...n,
          timeAgoText: formatTimeAgo(n.created_at),
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  const onNavigateToPost = useCallback(
    (postId: string) => {
      const notification = notificationsRef.current.find((n) => n.post_id === postId);
      if (!notification) return;
      const lastSeen = notification.created_at;
      setClearedPostMap((prev) => {
        const next = { ...prev, [postId]: lastSeen };
        saveClearedMap(next);
        return next;
      });
      setNotifications((current) =>
        current.map((n) =>
          n.post_id === postId ? { ...n, notification_count: 0 } : n
        )
      );
      router.push(`/notification/${postId}`);
    },
    [router]
  );

  const refresh = useCallback(() => {
    const uid = userIdRef.current;
    if (uid) fetchFirstPage(uid);
  }, [fetchFirstPage]);

  return {
    loading,
    notifications,
    visibleItemsWithTime,
    lastElementRef,
    onNavigateToPost,
    loadingMore,
    hasMore,
    scrollContainerRef,
    refresh,
  };
}
