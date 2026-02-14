'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchNotificationFeed } from '@/utils/notificationFeed';
import { formatTimeAgo } from '@/utils/formatTime';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';
import { sequentialIncreaseCount } from '@/utils/preloadSequential';
import type { NotificationFeedItem } from '@/utils/notificationFeed';

const STORAGE_KEY = 'notification_cleared_posts';
const HOME_OPENED_KEY = 'notification_home_last_opened_at';

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
  const [notifications, setNotifications] = useState<NotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearedPostMap, setClearedPostMap] = useState<Record<string, string>>({});
  const [clearedMapReady, setClearedMapReady] = useState(false);
  const clearedPostMapRef = useRef<Record<string, string>>({});
  const notificationsRef = useRef<NotificationFeedItem[]>([]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [localLoadingMore, setLocalLoadingMore] = useState(false);

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
    setVisibleCount(PAGE_SIZE);
  }, [notifications.length]);

  const fetchNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { list, rawFeed } = await fetchNotificationFeed(userId, clearedPostMapRef.current);
      if (rawFeed.length > 0) {
        try {
          await supabase
            .from('notification_reads')
            .upsert(
              rawFeed.map((n: { id: string }) => ({ user_id: userId, notification_id: n.id })),
              { onConflict: 'user_id,notification_id' }
            );
        } catch {
          // ignore mark-read failure
        }
      }
      setNotifications(list);
    } catch (err) {
      console.error('Fetch Error:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clearedMapReady) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        fetchNotifications(session.user.id).then(() => {
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
    return () => { cancelled = true; };
  }, [clearedMapReady, fetchNotifications]);

  const hasMore = useMemo(
    () => visibleCount < notifications.length,
    [visibleCount, notifications.length]
  );

  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount]
  );

  const visibleItemsWithTime = useMemo<NotificationItemWithTime[]>(
    () =>
      visibleNotifications.map((n) => ({
        ...n,
        timeAgoText: formatTimeAgo(n.created_at),
      })),
    [visibleNotifications]
  );

  const { lastElementRef } = useInfiniteScroll({
    loadingMore: localLoadingMore,
    hasMore,
    onLoadMore: useCallback(() => {
      if (localLoadingMore || !hasMore) return;
      setLocalLoadingMore(true);
      sequentialIncreaseCount({
        maxSteps: PREFETCH_COUNT,
        setValue: setVisibleCount,
        getLimit: () => notificationsRef.current.length,
        onDone: () => setLocalLoadingMore(false),
      });
    }, [localLoadingMore, hasMore]),
    threshold: 0.2,
  });

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

  return {
    loading,
    notifications,
    visibleItemsWithTime,
    lastElementRef,
    onNavigateToPost,
  };
}
