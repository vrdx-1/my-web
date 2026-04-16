'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchNotificationFeed } from '@/utils/notificationFeed';
import { formatTimeAgo } from '@/utils/formatTime';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { NOTIFICATION_PAGE_SIZE, FEED_PRELOAD_ROOT_MARGIN, FEED_PRELOAD_THRESHOLD, NOTIFICATION_LIST_CACHE_MAX_AGE_MS } from '@/utils/constants';
import type { NotificationFeedItem } from '@/utils/notificationFeed';
import type { CachedBoosts } from '@/utils/notificationFeed';

const STORAGE_KEY = 'notification_cleared_posts';
const HOME_OPENED_KEY = 'notification_home_last_opened_at';
const LIST_CACHE_KEY = 'notification_list_cache';

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

function loadListCache(): { list: NotificationFeedItem[]; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { list?: NotificationFeedItem[]; ts?: number };
    if (!parsed?.list || !Array.isArray(parsed.list) || typeof parsed.ts !== 'number') return null;
    const age = Date.now() - parsed.ts;
    if (age > NOTIFICATION_LIST_CACHE_MAX_AGE_MS) return null;
    return { list: parsed.list, ts: parsed.ts };
  } catch {
    return null;
  }
}

function saveListCache(list: NotificationFeedItem[]) {
  try {
    window.localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ list, ts: Date.now() }));
  } catch {
    // ignore
  }
}

export interface NotificationItemWithTime extends NotificationFeedItem {
  timeAgoText: string;
}

export interface UseNotificationPageOptions {
  /** เมื่อ false = ไม่อัปเดต state หลัง fetch (ใช้ตอนสลับออกจากหน้าแต่ยังเก็บหน้าไว้แบบ MainTabPanels) */
  isActive?: boolean;
}

export function useNotificationPage(options: UseNotificationPageOptions = {}) {
  const { isActive = true } = options;
  const router = useRouter();
  const { session, activeProfileId } = useSessionAndProfile();
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
  const isMountedRef = useRef(true);

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** ไม่ผูก isMountedRef กับ isActive — ให้รับผล fetch เสมอ เก็บข้อมูลไว้ พอสลับมาแจ้งเตือนจะได้โชว์ทันที ไม่ช้า */

  const fetchFirstPage = useCallback(async (userId: string, backgroundRefresh = false) => {
    userIdRef.current = userId;
    if (!backgroundRefresh) setLoading(true);
    try {
      const result = await fetchNotificationFeed(
        userId,
        clearedPostMapRef.current,
        { limit: NOTIFICATION_PAGE_SIZE }
      );
      if (!isMountedRef.current) return;
      if (result.boostsForCache) boostsCacheRef.current = result.boostsForCache;
      setNotifications(result.list);
      setHasMore(result.hasMore ?? false);
      saveListCache(result.list);
      const raw = result.rawFeed;
      lastCursorRef.current =
        raw?.length > 0 && raw[raw.length - 1]?.id && raw[raw.length - 1]?.created_at
          ? { created_at: raw[raw.length - 1].created_at, id: raw[raw.length - 1].id }
          : null;
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Fetch Error:', err);
      setNotifications([]);
      setHasMore(false);
      lastCursorRef.current = null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        const scrollToTop = () => {
          if (typeof window !== 'undefined') window.scrollTo(0, 0);
          scrollContainerRef.current?.scrollTo(0, 0);
        };
        requestAnimationFrame(() => requestAnimationFrame(scrollToTop));
      }
    }
  }, []);

  useEffect(() => {
    if (!clearedMapReady) return;
    let cancelled = false;
    const effectiveUserId = activeProfileId || session?.user?.id || null;
    const cached = loadListCache();
    if (cached && cached.list.length > 0) {
      setNotifications(cached.list);
      setLoading(false);
    }
    if (effectiveUserId) {
      const isBackground = !!(cached && cached.list.length > 0);
      fetchFirstPage(effectiveUserId, isBackground).then(() => {
        if (!cancelled && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(HOME_OPENED_KEY, new Date().toISOString());
          } catch {
            // ignore
          }
        }
      });
    } else {
      supabase.auth.getSession().then(({ data: { session: fetchedSession } }) => {
        if (cancelled) return;
        if (fetchedSession?.user?.id) {
          const isBackground = !!(cached && cached.list.length > 0);
          fetchFirstPage(fetchedSession.user.id, isBackground).then(() => {
            if (!cancelled && typeof window !== 'undefined') {
              try {
                window.localStorage.setItem(HOME_OPENED_KEY, new Date().toISOString());
              } catch {
                // ignore
              }
            }
          });
        } else if (isMountedRef.current) {
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled && isMountedRef.current) setLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, clearedMapReady, fetchFirstPage, session?.user?.id]);

  const loadMore = useCallback(async () => {
    debugLog('loadMore called', { loadingMore, hasMore });
    if (loadingMore || !hasMore) {
      debugLog('skip: loadingMore=', loadingMore, 'hasMore=', hasMore);
      return;
    }
    const userId = userIdRef.current ?? activeProfileId ?? session?.user?.id ?? (await supabase.auth.getSession()).data.session?.user?.id;
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
      if (!isMountedRef.current) return;
      const raw = result.rawFeed;
      if (raw?.length > 0 && raw[raw.length - 1]?.id && raw[raw.length - 1]?.created_at) {
        lastCursorRef.current = { created_at: raw[raw.length - 1].created_at, id: raw[raw.length - 1].id };
      }
      debugLog('API returned', result.list.length, 'items, hasMore=', result.hasMore, 'rawRows=', raw?.length);
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
      if (isMountedRef.current) {
        console.error('Load more Error:', err);
        setHasMore(false);
      }
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
    }
  }, [activeProfileId, hasMore, loadingMore, session?.user?.id]);

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
      // เด้งเข้าไปทันที — ไม่อัปเดต state ก่อน เพื่อไม่ให้รายการเปลี่ยนสีก่อนเข้า
      router.push(`/notification/${postId}`);
      // เปลี่ยนสีรายการ (ทะเล → ขาว) ทำหลังเข้าไปแล้ว; ตอนกดออกมาจะเห็นเป็นสีขาวทันที
      requestAnimationFrame(() => {
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
      });
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
