import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { FEED_PAGE_SIZE } from '@/utils/constants';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';
import {
  FEED_TOP_CACHE_SIZE,
  feedCacheKey,
  type FeedCachePayload,
  type FeedCacheStatus,
  getFeedFromCache,
  getFeedTop100FromCache,
  setFeedCache,
  setFeedTop100Cache,
} from '@/lib/redis';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import {
  buildPersonalizedFeedOrder,
  fetchUserSearchTerms,
  fetchTrendingTerms,
  type PersonalizedFeedRow,
  type UserSearchTerm,
  type TrendingTerm,
} from '@/lib/personalizedFeed';

// ─── Types ────────────────────────────────────────────────────────────────────

/** FeedOrderRow = PersonalizedFeedRow (includes caption for in-memory scoring) */
type FeedOrderRow = PersonalizedFeedRow;

type FeedPostRow = {
  id: string;
  status: string;
  is_hidden: boolean | null;
};

type FeedResult = { postIds: string[]; hasMore: boolean; posts: FeedPostRow[]; feedSeed?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveFeedStatus(value: unknown): FeedCacheStatus {
  return value === 'sold' ? 'sold' : 'recommend';
}

function createFeedSeed(): string {
  return randomUUID();
}

/** Sanitise guest token from request body (device ID — not used for auth) */
function sanitizeGuestToken(raw: unknown): string | undefined {
  if (
    typeof raw === 'string' &&
    raw.length > 0 &&
    raw.length < 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(raw)
  ) {
    return raw;
  }
  return undefined;
}

// ─── DB fetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch all visible posts for feed ordering.
 * Fetches `caption` so personalised scoring runs entirely in memory (no extra DB round-trip).
 */
async function fetchAllFeedOrderRows(
  supabase: ReturnType<typeof createServerClient>,
  province?: string,
  status: FeedCacheStatus = 'recommend',
): Promise<FeedOrderRow[]> {
  const rows: FeedOrderRow[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('cars')
      .select('id, is_boosted, user_id, guest_token, is_guest, created_at, caption, profiles!cars_user_id_fkey(is_verified)')
      .eq('status', status)
      .or('is_hidden.eq.false,is_hidden.is.null');

    if (province && province.trim() !== '') {
      query = query.eq('province', province.trim());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error('Feed query failed');
    const chunk = (data || []) as FeedOrderRow[];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
    offset += batchSize;
  }

  return rows;
}

async function hydrateFeedPosts(
  supabase: ReturnType<typeof createServerClient>,
  postIds: string[],
  status: FeedCacheStatus = 'recommend',
): Promise<FeedPostRow[]> {
  if (postIds.length === 0) return [];
  const { data: postsData, error: postsErr } = await supabase
    .from('cars')
    .select(POST_WITH_PROFILE_SELECT)
    .in('id', postIds);
  if (postsErr || !postsData?.length) return [];
  const order = new Map(postIds.map((id: string, idx: number) => [String(id), idx]));
  const filtered: FeedPostRow[] = (postsData as FeedPostRow[]).filter(
    (post) => post.status === status && !post.is_hidden,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrated: FeedPostRow[] = await (attachEffectiveWhatsAppPhones as any)(supabase, filtered);
  hydrated.sort((a, b) => (order.get(String(a.id)) ?? 1e9) - (order.get(String(b.id)) ?? 1e9));
  return hydrated;
}

function sliceFeedPayload(
  payload: FeedCachePayload,
  startIndex: number,
  endIndex: number,
): FeedResult {
  const postIds = payload.postIds.slice(startIndex, endIndex + 1);
  const posts = (payload.posts as FeedPostRow[]).slice(startIndex, endIndex + 1);
  const hasMore = payload.postIds.length > endIndex + 1 || payload.hasMore;
  return { postIds, hasMore, posts, feedSeed: payload.feedSeed };
}

// ─── Feed computation ─────────────────────────────────────────────────────────

async function computeFeed(
  supabase: ReturnType<typeof createServerClient>,
  startIndex: number,
  endIndex: number,
  province?: string,
  feedSeed?: string,
  status: FeedCacheStatus = 'recommend',
  userTerms: UserSearchTerm[] = [],
  trendingTerms: TrendingTerm[] = [],
  viewerUserId?: string,
  viewerGuestToken?: string,
): Promise<FeedResult> {
  const resolvedSeed = feedSeed || createFeedSeed();
  const orderedIds = buildPersonalizedFeedOrder(
    await fetchAllFeedOrderRows(supabase, province, status),
    resolvedSeed,
    userTerms,
    trendingTerms,
    viewerUserId,
    viewerGuestToken,
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
  status: FeedCacheStatus = 'recommend',
  userTerms: UserSearchTerm[] = [],
  trendingTerms: TrendingTerm[] = [],
  viewerUserId?: string,
  viewerGuestToken?: string,
): Promise<FeedResult> {
  const resolvedSeed = feedSeed || createFeedSeed();
  const orderedIds = buildPersonalizedFeedOrder(
    await fetchAllFeedOrderRows(supabase, province, status),
    resolvedSeed,
    userTerms,
    trendingTerms,
    viewerUserId,
    viewerGuestToken,
  );
  const cursorIndex = orderedIds.findIndex((id) => id === cursorId);
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const allIds = orderedIds.slice(startIndex, startIndex + pageSize + 1);
  const hasMore = allIds.length > pageSize;
  const postIds = hasMore ? allIds.slice(0, pageSize) : allIds;
  const posts = await hydrateFeedPosts(supabase, postIds, status);
  return { postIds, hasMore, posts, feedSeed: resolvedSeed };
}

// ─── POST /api/posts/feed ─────────────────────────────────────────────────────
/**
 * Body: { startIndex?, endIndex?, province?, feedSeed?, status?, guestToken? }
 *    or { cursorId, cursorBoosted, cursorCreatedAt, pageSize?, province?, feedSeed?, status?, guestToken? }
 *
 * Personalisation rules:
 *  - userId: derived from session cookie (never trusted from body)
 *  - guestToken: accepted from body (low-sensitivity device ID for guests)
 *  - Has search history → personalised order, bypasses Redis cache
 *  - No search history  → trending-enhanced order, uses Redis cache (shared)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:feed:post',
      identifier: ip,
      limit: 120,
      windowSeconds: 60,
    });
    if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

    const body = await request.json().catch(() => ({}));
    const province = typeof body.province === 'string' ? body.province : undefined;
    const requestedFeedSeed =
      typeof body.feedSeed === 'string' && body.feedSeed ? body.feedSeed : undefined;
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
      },
    );

    // ── Resolve caller identity ───────────────────────────────────────────────
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    const userId = sessionUser?.id || undefined;
    const guestToken = !userId ? sanitizeGuestToken(body.guestToken) : undefined;

    // ── Fetch personalisation data in parallel ────────────────────────────────
    // trending is always fetched (Redis-cached, very fast)
    // user terms only fetched when identity is known
    const [userTerms, trendingTerms] = await Promise.all([
      fetchUserSearchTerms(supabase, userId, guestToken),
      fetchTrendingTerms(supabase),
    ]);

    // Users with search history get a per-user order → bypass shared Redis cache
    const isPersonalized = userTerms.length > 0;
    const shouldBypassCache = !!requestedFeedSeed || isPersonalized;

    // ── Cursor-based load-more ────────────────────────────────────────────────
    const cursorId = typeof body.cursorId === 'string' ? body.cursorId : undefined;
    const cursorBoosted = body.cursorBoosted;
    const cursorCreatedAt =
      typeof body.cursorCreatedAt === 'string' ? body.cursorCreatedAt : undefined;
    if (cursorId && cursorCreatedAt && typeof cursorBoosted === 'boolean') {
      const pageSize = Math.min(
        Math.max(1, parseInt(String(body.pageSize ?? FEED_PAGE_SIZE), 10)),
        50,
      );
      const result = await computeFeedWithCursor(
        supabase, cursorId, pageSize, province, requestedFeedSeed, status,
        userTerms, trendingTerms,
        userId, guestToken,
      );
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
      });
    }

    const startIndex = parseInt(String(body.startIndex ?? 0), 10);
    const endIndex = parseInt(String(body.endIndex ?? FEED_PAGE_SIZE - 1), 10);

    // ── Cached path (no personal history) → shared trending-enhanced cache ────
    if (!shouldBypassCache && endIndex < FEED_TOP_CACHE_SIZE) {
      let topCache = await getFeedTop100FromCache(province, status);
      const cacheHit = !!topCache;
      if (!topCache) {
        const full = await computeFeed(
          supabase, 0, FEED_TOP_CACHE_SIZE - 1, province, requestedFeedSeed, status,
          [], trendingTerms,
          userId, guestToken,
        );
        await setFeedTop100Cache(province, full, status);
        topCache = full;
      }
      const result = sliceFeedPayload(topCache, startIndex, endIndex);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'private, max-age=0',
          'X-Feed-Cache': cacheHit ? 'HIT' : 'MISS',
        },
      });
    }

    // ── Bypass-cache path (personalised or explicit feedSeed) ─────────────────
    if (shouldBypassCache) {
      const result = await computeFeed(
        supabase, startIndex, endIndex, province, requestedFeedSeed, status,
        userTerms, trendingTerms,
        userId, guestToken,
      );
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
      });
    }

    // ── Range cache (deep pagination, no personalisation) ─────────────────────
    const cacheKey = feedCacheKey(startIndex, endIndex, province, status);
    const cached = await getFeedFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'HIT' },
      });
    }
    const result = await computeFeed(
      supabase, startIndex, endIndex, province, requestedFeedSeed, status,
      [], trendingTerms,
      userId, guestToken,
    );
    await setFeedCache(cacheKey, result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
    });
  } catch (err) {
    return internalServerError('posts/feed POST failed', err);
  }
}

// ─── GET /api/posts/feed (no personalisation — used by external tools) ─────────
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:feed:get',
      identifier: ip,
      limit: 120,
      windowSeconds: 60,
    });
    if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

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
      },
    );

    // GET has no body → use trending-only ordering (no personalisation)
    const trendingTerms = await fetchTrendingTerms(supabase);

    if (!shouldBypassCache && endIndex < FEED_TOP_CACHE_SIZE) {
      let topCache = await getFeedTop100FromCache(province, status);
      const cacheHit = !!topCache;
      if (!topCache) {
        const full = await computeFeed(
          supabase, 0, FEED_TOP_CACHE_SIZE - 1, province, requestedFeedSeed, status,
          [], trendingTerms,
        );
        await setFeedTop100Cache(province, full, status);
        topCache = full;
      }
      const result = sliceFeedPayload(topCache, startIndex, endIndex);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'private, max-age=0',
          'X-Feed-Cache': cacheHit ? 'HIT' : 'MISS',
        },
      });
    }

    if (shouldBypassCache) {
      const result = await computeFeed(
        supabase, startIndex, endIndex, province, requestedFeedSeed, status,
        [], trendingTerms,
      );
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
    const result = await computeFeed(
      supabase, startIndex, endIndex, province, requestedFeedSeed, status,
      [], trendingTerms,
    );
    await setFeedCache(cacheKey, result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0', 'X-Feed-Cache': 'MISS' },
    });
  } catch (err) {
    return internalServerError('posts/feed GET failed', err);
  }
}
