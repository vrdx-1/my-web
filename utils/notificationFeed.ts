/**
 * Shared notification feed: fetch feed + boosts, merge, and return list + totalUnread.
 * Uses boost updated_at when present so status changes (e.g. pending→success) count as new and sort latest first.
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
  likes?: number;
  saves?: number;
  notification_count?: number;
  interaction_avatars?: (string | null)[];
  interaction_total?: number;
  boost_status?: 'pending' | 'reject' | 'success' | string | null;
  boost_expires_at?: string | null;
}

export interface FetchNotificationFeedResult {
  list: NotificationFeedItem[];
  totalUnread: number;
  rawFeed: any[];
}

export async function fetchNotificationFeed(
  userId: string,
  clearedMap: Record<string, string>
): Promise<FetchNotificationFeedResult> {
  const { data, error } = await supabase.rpc('get_notifications_feed', {
    p_owner_id: userId,
  });

  if (error) throw error;

  const rawList = data && Array.isArray(data) ? (data as any[]) : [];
  const formatted: NotificationFeedItem[] = rawList.map((item: any) => ({
    id: item.id,
    type: item.type,
    post_id: item.post_id,
    created_at: item.created_at,
    sender_name: item.username || 'User',
    sender_avatar: item.avatar_url,
    post_caption: item.car_data?.caption || '',
    post_images: item.car_data?.images || [],
    likes: item.likes_count || 0,
    saves: item.saves_count || 0,
    interaction_avatars: item.interaction_avatars || [],
    interaction_total: item.interaction_total || 0,
  }));

  const perPost = new Map<string, { notif: NotificationFeedItem; count: number }>();
  formatted.forEach((notif) => {
    const existing = perPost.get(notif.post_id);
    const clearedAt = clearedMap[notif.post_id];
    const clearedTime = clearedAt ? new Date(clearedAt).getTime() : 0;
    const notifTime = new Date(notif.created_at).getTime();
    const isNewForUser = notifTime > clearedTime;

    if (!existing) {
      perPost.set(notif.post_id, {
        notif,
        count: isNewForUser ? 1 : 0,
      });
    } else {
      const existingDate = new Date(existing.notif.created_at).getTime();
      if (notifTime > existingDate) {
        existing.notif = notif;
      }
      if (isNewForUser) {
        existing.count += 1;
      }
    }
  });

  let uniqueList: NotificationFeedItem[] = Array.from(perPost.values())
    .map(({ notif, count }) => ({
      ...notif,
      notification_count: count,
    }))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  let boostsData: any[] | null = null;
  let boostsError: any = null;
  try {
    const res = await supabase
      .from('post_boosts')
      .select('post_id, status, created_at, expires_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    boostsData = res.data;
    boostsError = res.error;
    if (boostsError && String(boostsError.message || '').toLowerCase().includes('updated_at')) {
      const fallback = await supabase
        .from('post_boosts')
        .select('post_id, status, created_at, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      boostsData = fallback.data;
      boostsError = fallback.error;
    }
  } catch (_) {
    boostsError = true;
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
      if (!boostByPostId.has(pid)) {
        boostByPostId.set(pid, {
          status: String(b.status),
          created_at: b.created_at,
          expires_at: b.expires_at ?? null,
          event_at: eventAt,
        });
      }
    });
  }

  const feedPostIds = new Set(uniqueList.map((n) => String(n.post_id)));
  const mergedList: NotificationFeedItem[] = uniqueList.map((n) => {
    const boost = boostByPostId.get(String(n.post_id));
    if (!boost) return n;
    const notifTime = new Date(n.created_at).getTime();
    const boostTime = new Date(boost.event_at).getTime();
    const clearedTime = clearedMap[n.post_id]
      ? new Date(clearedMap[n.post_id]).getTime()
      : 0;
    const latestTime = Math.max(notifTime, boostTime);
    const created_at = new Date(latestTime).toISOString();
    const boostCount = boostTime > clearedTime ? 1 : 0;
    return {
      ...n,
      boost_status: boost.status,
      boost_expires_at: boost.expires_at,
      created_at,
      notification_count: (n.notification_count ?? 0) + boostCount,
    };
  });

  const boostOnlyPostIds = Array.from(boostByPostId.keys()).filter(
    (pid) => !feedPostIds.has(pid)
  );

  if (boostOnlyPostIds.length > 0) {
    const { data: carsData } = await supabase
      .from('cars')
      .select('id, caption, images')
      .in('id', boostOnlyPostIds);

    const carsByPostId = new Map<
      string,
      { caption?: string; images?: string[] }
    >();
    if (carsData) {
      (carsData as any[]).forEach((c) => {
        carsByPostId.set(String(c.id), {
          caption: c.caption,
          images: c.images ?? [],
        });
      });
    }

    boostOnlyPostIds.forEach((postId) => {
      const boost = boostByPostId.get(postId);
      if (!boost) return;
      const clearedTime = clearedMap[postId]
        ? new Date(clearedMap[postId]).getTime()
        : 0;
      const boostTime = new Date(boost.event_at).getTime();
      const car = carsByPostId.get(postId);
      mergedList.push({
        id: `boost-${postId}`,
        post_id: postId,
        type: 'boost',
        created_at: boost.event_at,
        sender_name: 'ລະບົບ',
        sender_avatar: null,
        post_caption: car?.caption ?? '',
        post_images: car?.images ?? [],
        likes: 0,
        saves: 0,
        interaction_avatars: [],
        interaction_total: 0,
        boost_status: boost.status,
        boost_expires_at: boost.expires_at,
        notification_count: boostTime > clearedTime ? 1 : 0,
      });
    });
  }

  const sortedList = mergedList.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalUnread = sortedList.reduce(
    (sum, n) => sum + (n.notification_count ?? 0),
    0
  );

  return { list: sortedList, totalUnread, rawFeed: rawList };
}
