import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { FEED_PAGE_SIZE } from '@/utils/constants';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import {
  FEED_TOP_CACHE_SIZE,
  feedCacheKey,
  type FeedCacheStatus,
  getFeedFromCache,
  getFeedTop100FromCache,
  setFeedCache,
  setFeedTop100Cache,
} from '@/lib/redis';

type FeedOrderRow = {
  id: string;
  is_boosted: boolean;
  user_id: string | null;
  guest_token: string | null;
  is_guest: boolean | null;
  created_at: string | null;
};

type FeedResult = { postIds: string[]; hasMore: boolean; posts: any[]; feedSeed?: string };

function resolveFeedStatus(value: unknown): FeedCacheStatus {
  return value === 'sold' ? 'sold' : 'recommend';
}

function createFeedSeed(): string {
  return randomUUID();
}

function getAccountKey(row: FeedOrderRow): string {
  if (row.user_id) return `user:${row.user_id}`;
  if (row.guest_token) return `guest:${row.guest_token}`;
  if (row.is_guest) return `guest-post:${row.id}`;
  return `post:${row.id}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sortRowsWithinAccount(rows: FeedOrderRow[], feedSeed: string): FeedOrderRow[] {
  return [...rows].sort((left, right) => {
    const scoreDiff =
      hashString(`${feedSeed}:post:${left.id}`) - hashString(`${feedSeed}:post:${right.id}`);
    if (scoreDiff !== 0) return scoreDiff;
    const createdDiff = (right.created_at || '').localeCompare(left.created_at || '');
    if (createdDiff !== 0) return createdDiff;
    return String(left.id).localeCompare(String(right.id));
  });
}

function interleaveAccounts(rows: FeedOrderRow[], feedSeed: string): FeedOrderRow[] {
  const byAccount = new Map<string, FeedOrderRow[]>();
  rows.forEach((row) => {
    const accountKey = getAccountKey(row);
    const current = byAccount.get(accountKey);
    if (current) current.push(row);
    else byAccount.set(accountKey, [row]);
  });

  const queue = Array.from(byAccount.entries())
    .map(([accountKey, accountRows]) => ({
      accountKey,
      rows: sortRowsWithinAccount(accountRows, feedSeed),
      score: hashString(`${feedSeed}:account:${accountKey}`),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.accountKey.localeCompare(right.accountKey);
    });

  const ordered: FeedOrderRow[] = [];
  let lastAccountKey: string | null = null;
  while (queue.length > 0) {
    let queueIndex = queue.findIndex((entry) => entry.accountKey !== lastAccountKey);
    if (queueIndex === -1) queueIndex = 0;
    const [entry] = queue.splice(queueIndex, 1);
    const nextRow = entry.rows.shift();
    if (!nextRow) continue;
    ordered.push(nextRow);
    lastAccountKey = entry.accountKey;
    if (entry.rows.length > 0) queue.push(entry);
  }

  return ordered;
}

function buildRandomizedFeedOrder(rows: FeedOrderRow[], feedSeed: string): string[] {
  const boosted = rows.filter((row) => row.is_boosted);
  const regular = rows.filter((row) => !row.is_boosted);
  return [...interleaveAccounts(boosted, feedSeed), ...interleaveAccounts(regular, feedSeed)].map((row) => row.id);
}

async function fetchAllFeedOrderRows(
  supabase: ReturnType<typeof createServerClient>,
  province?: string,
  status: FeedCacheStatus = 'recommend'
) {
  const rows: FeedOrderRow[] = [];
  const pageSize = 1000;
  let startIndex = 0;

  while (true) {
    let query = supabase
      .from('cars')
      .select('id, is_boosted, user_id, guest_token, is_guest, created_at')
      .eq('status', status)
      .or('is_hidden.eq.false,is_hidden.is.null');
    if (province && province.trim() !== '') {
      query = query.eq('province', province.trim());
    }
    const endIndex = startIndex + pageSize - 1;
    const { data, error } = await query
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(startIndex, endIndex);

    if (error) throw new Error(error.message);
    const chunk = (data || []) as FeedOrderRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    startIndex += pageSize;
  }

  return rows;
}

async function hydrateFeedPosts(
  supabase: ReturnType<typeof createServerClient>,
  postIds: string[],
  status: FeedCacheStatus = 'recommend'
): Promise<any[]> {
  if (postIds.length === 0) return [];
  const { data: postsData, error: postsErr } = await supabase
    .from('cars')
    .select(POST_WITH_PROFILE_SELECT)
    .in('id', postIds);
  if (postsErr || !postsData?.length) return [];
  const order = new Map(postIds.map((id: string, index: number) => [String(id), index]));
  const filtered = postsData.filter((post: any) => post.status === status && !post.is_hidden);
  filtered.sort((left: any, right: any) => {
    const leftIndex = order.get(String(left.id)) ?? 1e9;
    const rightIndex = order.get(String(right.id)) ?? 1e9;
    return leftIndex - rightIndex;
  });
  return filtered;
}

/** ตัดช่วงจาก payload ตาม startIndex, endIndex */
function sliceFeedPayload(payload: FeedResult, startIndex: number, endIndex: number): FeedResult {
  const postIds = payload.postIds.slice(startIndex, endIndex + 1);
  const posts = payload.posts.slice(startIndex, endIndex + 1);
  const hasMore = payload.postIds.length > endIndex + 1 || payload.hasMore;
  return { postIds, hasMore, posts, feedSeed: payload.feedSeed };
}

async function computeFeed(
  supabase: ReturnType<typeof createServerClient>,
  startIndex: number,
  endIndex: number,
  province?: string,
  feedSeed?: string,
  status: FeedCacheStatus = 'recommend'
): Promise<FeedResult> {
  const resolvedSeed = feedSeed || createFeedSeed();
  const orderedIds = buildRandomizedFeedOrder(
    await fetchAllFeedOrderRows(supabase, province, status),
    resolvedSeed,
  );
  const postIds = orderedIds.slice(startIndex, endIndex + 1);
  const hasMore = endIndex + 1 < orderedIds.length;
  const posts = await hydrateFeedPosts(supabase, postIds, status);
  return { postIds, hasMore, posts, feedSeed: resolvedSeed };
}

async function computeFeedWithCursor(
  supabase: ReturnType<typeof createServerClient>,
  cursorId: string,
  pageSize: number,
  province?: string,
  feedSeed?: string,
  status: FeedCacheStatus = 'recommend'
): Promise<FeedResult> {
  const resolvedSeed = feedSeed || createFeedSeed();
  const orderedIds = buildRandomizedFeedOrder(
    await fetchAllFeedOrderRows(supabase, province, status),
    resolvedSeed,
  );
  const cursorIndex = orderedIds.findIndex((id) => id === cursorId);
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const allIds = orderedIds.slice(startIndex, startIndex + pageSize + 1);
  const hasMore = allIds.length > pageSize;
  const postIds = hasMore ? allIds.slice(0, pageSize) : allIds;
  const posts = await hydrateFeedPosts(supabase, postIds, status);
  return { postIds, hasMore, posts, feedSeed: resolvedSeed };
}

/**
 * POST /api/posts/feed — body: { startIndex, endIndex, province? } หรือ { cursorId, cursorBoosted, cursorCreatedAt, pageSize?, province? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const province = typeof body.province === 'string' ? body.province : undefined;
    const requestedFeedSeed = typeof body.feedSeed === 'string' && body.feedSeed ? body.feedSeed : undefined;
    const status = resolveFeedStatus(body.status);

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Cursor-based: โหลดหน้าถัดไปเร็วเท่ากันไม่ว่าเลื่อนลึกแค่ไหน (ไม่ใช้ OFFSET)
    const cursorId = typeof body.cursorId === 'string' ? body.cursorId : undefined;
    const cursorBoosted = body.cursorBoosted;
    const cursorCreatedAt = typeof body.cursorCreatedAt === 'string' ? body.cursorCreatedAt : undefined;
    if (cursorId && cursorCreatedAt && typeof cursorBoosted === 'boolean') {
      const pageSize = Math.min(Math.max(1, parseInt(String(body.pageSize ?? FEED_PAGE_SIZE), 10)), 50);
      const result = await computeFeedWithCursor(supabase, cursorId, pageSize, province, requestedFeedSeed, status);
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
      });
    }

    const startIndex = parseInt(String(body.startIndex ?? 0), 10);
    const endIndex = parseInt(String(body.endIndex ?? FEED_PAGE_SIZE - 1), 10);
    const shouldBypassCache = !!requestedFeedSeed;

    // ช่วง 0–(N-1) ใช้ cache ชุดโพส N รายการ (โพสล่าสุด + Boost) อายุ 1 นาที
    if (!shouldBypassCache && endIndex < FEED_TOP_CACHE_SIZE) {
      let topCache = await getFeedTop100FromCache(province, status);
      const cacheHit = !!topCache;
      if (!topCache) {
        const full = await computeFeed(supabase, 0, FEED_TOP_CACHE_SIZE - 1, province, requestedFeedSeed, status);
        await setFeedTop100Cache(province, full, status);
        topCache = full;
      }
      const result = sliceFeedPayload(topCache, startIndex, endIndex);
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': cacheHit ? 'HIT' : 'MISS' },
      });
    }

    if (shouldBypassCache) {
      const result = await computeFeed(supabase, startIndex, endIndex, province, requestedFeedSeed, status);
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
      });
    }

    const cacheKey = feedCacheKey(startIndex, endIndex, province, status);
    const cached = await getFeedFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'HIT' },
      });
    }

    const result = await computeFeed(supabase, startIndex, endIndex, province, requestedFeedSeed, status);
    await setFeedCache(cacheKey, result);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
    });
  } catch (err: any) {
    console.error('API /api/posts/feed POST:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posts/feed?startIndex=0&endIndex=9
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    const endIndex = parseInt(searchParams.get('endIndex') || String(FEED_PAGE_SIZE - 1), 10);
    const province = searchParams.get('province') ?? undefined;
    const requestedFeedSeed = searchParams.get('feedSeed') || undefined;
    const status = resolveFeedStatus(searchParams.get('status'));
    const shouldBypassCache = !!requestedFeedSeed;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // ช่วง 0–(N-1) ใช้ cache ชุดโพส N รายการ (โพสล่าสุด + Boost) อายุ 1 นาที
    if (!shouldBypassCache && endIndex < FEED_TOP_CACHE_SIZE) {
      let topCache = await getFeedTop100FromCache(province, status);
      const cacheHit = !!topCache;
      if (!topCache) {
        const full = await computeFeed(supabase, 0, FEED_TOP_CACHE_SIZE - 1, province, requestedFeedSeed, status);
        await setFeedTop100Cache(province, full, status);
        topCache = full;
      }
      const result = sliceFeedPayload(topCache, startIndex, endIndex);
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': cacheHit ? 'HIT' : 'MISS' },
      });
    }

    if (shouldBypassCache) {
      const result = await computeFeed(supabase, startIndex, endIndex, province, requestedFeedSeed, status);
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
      });
    }

    const cacheKey = feedCacheKey(startIndex, endIndex, province, status);
    const cached = await getFeedFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'HIT' },
      });
    }

    const result = await computeFeed(supabase, startIndex, endIndex, province, requestedFeedSeed, status);
    await setFeedCache(cacheKey, result);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
    });
  } catch (err: any) {
    console.error('API /api/posts/feed GET:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
