/**
 * Shared notification feed: boost-only notifications.
 * Uses boost updated_at when present so status changes (e.g. pending->success)
 * count as new and sort latest first.
 */

import { supabase } from '@/lib/supabase';

export interface NotificationFeedItem {
  id: string;
  post_id: string;
  type: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
  post_caption?: string;
  post_images?: string[];
  notification_count?: number;
  boost_status?: 'pending' | 'reject' | 'success' | string | null;
  boost_expires_at?: string | null;
}

export interface FetchNotificationFeedResult {
  list: NotificationFeedItem[];
  totalUnread: number;
  rawFeed: any[];
  /** เท true เมื่อโหลดแบบแบ่งหน้าและยังมีหน้าถัดไป */
  hasMore?: boolean;
  /** เก็บไว้ส่งเป็น cachedBoosts ในครั้งถัดไป (โหลดเร็วขึ้น) */
  boostsForCache?: CachedBoosts;
}

export type CachedBoosts = { data: any[] | null; error: any } | null;

const CLEARED_MAP_STORAGE_KEY = 'notification_cleared_posts';

function loadClearedMapForUnread(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CLEARED_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return {};
}

/** ดึงจำนวน boost notification ที่ยังไม่อ่าน (สำหรับ badge) */
export async function fetchNotificationUnreadCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('post_boosts')
    .select('post_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return 0;

  const clearedMap = loadClearedMapForUnread();
  const latestBoostByPost = new Map<string, string>();

  (data as any[]).forEach((row) => {
    const postId = String(row.post_id);
    const eventAt = String(row.updated_at ?? row.created_at);
    const current = latestBoostByPost.get(postId);
    if (!current || new Date(eventAt).getTime() > new Date(current).getTime()) {
      latestBoostByPost.set(postId, eventAt);
    }
  });

  const boostPostIds = Array.from(latestBoostByPost.keys());
  if (boostPostIds.length === 0) return 0;

  let soldPostIds = new Set<string>();
  const { data: carsStatusData } = await supabase
    .from('cars')
    .select('id, status')
    .in('id', boostPostIds);
  if (carsStatusData) {
    soldPostIds = new Set(
      (carsStatusData as { id: string; status: string }[])
        .filter((c) => c.status === 'sold')
        .map((c) => String(c.id))
    );
  }

  let unread = 0;
  latestBoostByPost.forEach((eventAt, postId) => {
    if (soldPostIds.has(postId)) return;
    const clearedAt = clearedMap[postId];
    const clearedTime = clearedAt ? new Date(clearedAt).getTime() : 0;
    const eventTime = new Date(eventAt).getTime();
    if (eventTime > clearedTime) unread += 1;
  });

  return unread;
}

export async function fetchNotificationFeed(
  userId: string,
  clearedMap: Record<string, string>,
  options?: { limit: number; cursor?: { created_at: string; id: string } },
  cachedBoosts?: CachedBoosts
): Promise<FetchNotificationFeedResult> {
  const boostsPromise = cachedBoosts
    ? Promise.resolve({ data: cachedBoosts.data, error: cachedBoosts.error })
    : supabase
        .from('post_boosts')
        .select('post_id, status, created_at, expires_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

  const boostsRes = await boostsPromise;

  let boostsData: any[] | null = boostsRes?.data ?? null;
  let boostsError: any = boostsRes?.error ?? null;
  if (!cachedBoosts && boostsError && String(boostsError?.message || '').toLowerCase().includes('updated_at')) {
    const fallback = await supabase
      .from('post_boosts')
      .select('post_id, status, created_at, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    boostsData = fallback.data;
    boostsError = fallback.error;
  }

  const boostByPostId = new Map<
    string,
    {
      status: string;
      created_at: string;
      expires_at: string | null;
      event_at: string;
    }
  >();
  if (!boostsError && boostsData) {
    (boostsData as any[]).forEach((b) => {
      const pid = String(b.post_id);
      const eventAt = (b as any).updated_at ?? b.created_at;
      const current = boostByPostId.get(pid);
      if (!current || new Date(eventAt).getTime() > new Date(current.event_at).getTime()) {
        boostByPostId.set(pid, {
          status: String(b.status),
          created_at: b.created_at,
          expires_at: b.expires_at ?? null,
          event_at: eventAt,
        });
      }
    });
  }

  // โพสต์ที่ขายแล้ว (ຂາຍແລ້ວ) ไม่แสดงแจ้งเตือนเกี่ยวกับสถานะโฆษณา — เหมือนไม่เคย boost
  const boostPostIds = Array.from(boostByPostId.keys());
  let soldPostIds = new Set<string>();
  if (boostPostIds.length > 0) {
    const { data: carsStatusData } = await supabase
      .from('cars')
      .select('id, status')
      .in('id', boostPostIds);
    if (carsStatusData) {
      soldPostIds = new Set(
        (carsStatusData as { id: string; status: string }[])
          .filter((c) => c.status === 'sold')
          .map((c) => String(c.id))
      );
    }
  }

  let boostList: NotificationFeedItem[] = Array.from(boostByPostId.entries())
    .filter(([pid]) => !soldPostIds.has(pid))
    .map(([postId, boost]) => {
      const clearedTime = clearedMap[postId]
        ? new Date(clearedMap[postId]).getTime()
        : 0;
      const boostTime = new Date(boost.event_at).getTime();
      return {
        id: `boost-${postId}`,
        post_id: postId,
        type: 'boost',
        created_at: boost.event_at,
        sender_name: 'ລະບົບ',
        sender_avatar: null,
        boost_status: boost.status,
        boost_expires_at: boost.expires_at,
        notification_count: boostTime > clearedTime ? 1 : 0,
      };
    })
    .sort(
      (a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return String(b.post_id).localeCompare(String(a.post_id));
      }
    );

  if (options?.cursor?.created_at && options?.cursor?.id) {
    const cursorTime = new Date(options.cursor.created_at).getTime();
    const cursorPostId = options.cursor.id;
    boostList = boostList.filter((item) => {
      const itemTime = new Date(item.created_at).getTime();
      if (itemTime < cursorTime) return true;
      if (itemTime > cursorTime) return false;
      return String(item.post_id) < String(cursorPostId);
    });
  }

  const limit = options?.limit && options.limit > 0 ? options.limit : 0;
  const hasMore = limit > 0 ? boostList.length > limit : false;
  const pagedList = limit > 0 ? boostList.slice(0, limit) : boostList;

  const pagedPostIds = pagedList.map((n) => n.post_id);
  let carsByPostId = new Map<string, { caption?: string; images?: string[] }>();
  if (pagedPostIds.length > 0) {
    const { data: carsData } = await supabase
      .from('cars')
      .select('id, caption, images')
      .in('id', pagedPostIds);

    if (carsData) {
      carsByPostId = new Map(
        (carsData as any[]).map((c) => [String(c.id), { caption: c.caption, images: c.images ?? [] }])
      );
    }
  }

  const sortedList = pagedList
    .map((n) => {
      const car = carsByPostId.get(String(n.post_id));
      return {
        ...n,
        post_caption: car?.caption ?? '',
        post_images: car?.images ?? [],
      };
    })
    .sort(
      (a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return String(b.post_id).localeCompare(String(a.post_id));
      }
    );

  const totalUnread = sortedList.reduce(
    (sum, n) => sum + (n.notification_count ?? 0),
    0
  );

  return {
    list: sortedList,
    totalUnread,
    rawFeed: sortedList.map((item) => ({ id: item.post_id, created_at: item.created_at })),
    hasMore,
    boostsForCache: { data: boostsData, error: boostsError },
  };
}
