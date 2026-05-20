/**
 * Personalized Feed — scoring & ordering logic
 *
 * Priority order (highest → lowest):
 *  1. Posts matching user's own search history  (personal)
 *  2. Posts matching global trending search terms (trending)
 *  3. Posts posted within the last 24 hours      (fresh)
 *  4. Everything else                            (regular)
 *
 * Boosted posts are NOT placed at the top — they are interleaved
 * every BOOST_INTERVAL regular positions so they don't dominate the feed.
 *
 * When userTerms is empty (guest/new user) the personal bucket is empty
 * and the feed starts with trending → fresh → regular.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import {
  getSearchPriorityTerms,
  captionContainsPriorityTerm,
  captionMatchesCategoryWithBrand,
  getSearchCategoryIds,
} from '@/utils/postUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserSearchTerm = {
  term_key: string;
  search_term: string;
  search_count: number;
};

export type TrendingTerm = {
  search_term: string;
  count: number;
};

export type PersonalizedFeedRow = {
  id: string;
  is_boosted: boolean;
  user_id: string | null;
  guest_token: string | null;
  is_guest: boolean | null;
  created_at: string | null;
  caption: string | null;
};

type ExpandedTerm = {
  weight: number;          // search_count for user terms, 1 for trending
  priorityTerms: string[];
  categoryIds: string[];
};

type ScoredRow = {
  row: PersonalizedFeedRow;
  score: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TRENDING_CACHE_KEY = 'feed:trending:terms:v1';
const TRENDING_CACHE_TTL_SEC = 5 * 60;   // 5 minutes
const TRENDING_LOOKBACK_DAYS = 7;
const MAX_TRENDING_SAMPLE = 2000;         // max search_logs rows to aggregate
const MAX_USER_TERMS = 20;
const MAX_TRENDING_TERMS = 30;

/** Number of regular posts between each boosted post insertion */
export const BOOST_INTERVAL = 5;

// ─── Hash helpers (same algorithm used in feed route for consistency) ─────────

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Keep score priority, but randomize order within nearby score bands on refresh.
 * This gives visible feed movement while preserving relevance.
 */
function sortScoredRowsWithSeed(rows: ScoredRow[], feedSeed: string): ScoredRow[] {
  return [...rows].sort((a, b) => {
    const scoreDiff = b.score - a.score;

    // Strongly better score always wins.
    if (Math.abs(scoreDiff) > 1) return scoreDiff;

    // Same/nearby score: use seed hash so refresh produces new order.
    const seedDiff =
      hashString(`${feedSeed}:bucket:${a.row.id}`) -
      hashString(`${feedSeed}:bucket:${b.row.id}`);
    if (seedDiff !== 0) return seedDiff;

    // Stable fallback.
    return String(a.row.id).localeCompare(String(b.row.id));
  });
}

function sortRowsWithSeed(rows: PersonalizedFeedRow[], feedSeed: string, scope: string): PersonalizedFeedRow[] {
  return [...rows].sort((a, b) => {
    const diff = hashString(`${feedSeed}:${scope}:${a.id}`) - hashString(`${feedSeed}:${scope}:${b.id}`);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });
}

// ─── Account-interleave (keep variety — no two consecutive posts from same seller) ──

function getAccountKey(row: PersonalizedFeedRow): string {
  if (row.user_id) return `user:${row.user_id}`;
  if (row.guest_token) return `guest:${row.guest_token}`;
  if (row.is_guest) return `guest-post:${row.id}`;
  return `post:${row.id}`;
}

function interleaveByAccount(
  rows: PersonalizedFeedRow[],
  feedSeed: string,
): PersonalizedFeedRow[] {
  if (rows.length === 0) return [];
  const byAccount = new Map<string, PersonalizedFeedRow[]>();
  for (const row of rows) {
    const key = getAccountKey(row);
    const existing = byAccount.get(key);
    if (existing) existing.push(row);
    else byAccount.set(key, [row]);
  }

  // Sort each account's posts by hash seed, then created_at
  const queue = Array.from(byAccount.entries())
    .map(([key, accountRows]) => ({
      key,
      rows: [...accountRows].sort((a, b) => {
        const diff =
          hashString(`${feedSeed}:post:${a.id}`) -
          hashString(`${feedSeed}:post:${b.id}`);
        return diff !== 0 ? diff : (b.created_at || '').localeCompare(a.created_at || '');
      }),
      score: hashString(`${feedSeed}:account:${key}`),
    }))
    .sort((a, b) => (a.score !== b.score ? a.score - b.score : a.key.localeCompare(b.key)));

  const result: PersonalizedFeedRow[] = [];
  let lastKey: string | null = null;
  while (queue.length > 0) {
    let idx = queue.findIndex((e) => e.key !== lastKey);
    if (idx === -1) idx = 0;
    const [entry] = queue.splice(idx, 1);
    const row = entry.rows.shift();
    if (!row) continue;
    result.push(row);
    lastKey = entry.key;
    if (entry.rows.length > 0) queue.push(entry);
  }
  return result;
}

// ─── Boost interleaving ───────────────────────────────────────────────────────

function interleaveBoost(
  regular: string[],
  boosted: string[],
  interval: number,
): string[] {
  if (boosted.length === 0) return regular;
  const result: string[] = [];
  let bi = 0;
  for (let i = 0; i < regular.length; i++) {
    result.push(regular[i]);
    if ((i + 1) % interval === 0 && bi < boosted.length) {
      result.push(boosted[bi++]);
    }
  }
  while (bi < boosted.length) result.push(boosted[bi++]);
  return result;
}

// ─── Term expansion ───────────────────────────────────────────────────────────

function expandTerm(term: string, weight: number): ExpandedTerm {
  return {
    weight,
    priorityTerms: getSearchPriorityTerms(term),
    categoryIds: getSearchCategoryIds(term),
  };
}

function captionMatchesExpanded(caption: string, expanded: ExpandedTerm): boolean {
  if (captionContainsPriorityTerm(caption, expanded.priorityTerms)) return true;
  if (expanded.categoryIds.length > 0 && captionMatchesCategoryWithBrand(caption, expanded.categoryIds)) return true;
  return false;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Fetch the current user's recent search history.
 * Returns empty array when neither userId nor guestToken is provided.
 */
export async function fetchUserSearchTerms(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId?: string,
  guestToken?: string,
): Promise<UserSearchTerm[]> {
  if (!userId && !guestToken) return [];

  let query = supabase
    .from('user_search_history')
    .select('term_key, search_term, search_count')
    .is('deleted_at', null)
    .order('last_searched_at', { ascending: false })
    .limit(MAX_USER_TERMS);

  if (userId) query = query.eq('user_id', userId);
  else query = query.eq('guest_token', guestToken!);

  const { data } = await query;
  return (data || []) as UserSearchTerm[];
}

/**
 * Fetch globally trending search terms (aggregated from search_logs).
 * Result is cached in Redis for TRENDING_CACHE_TTL_SEC seconds.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTrendingTerms(supabase: SupabaseClient<any>): Promise<TrendingTerm[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string>(TRENDING_CACHE_KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) return parsed as TrendingTerm[];
      }
    } catch {
      // cache error — fall through to DB
    }
  }

  const cutoff = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from('search_logs')
    .select('search_term')
    .in('actor_role', ['guest', 'user'])
    .gte('created_at', cutoff)
    .limit(MAX_TRENDING_SAMPLE);

  if (!data || data.length === 0) return [];

  // Aggregate counts in JS
  const counts = new Map<string, number>();
  for (const row of data) {
    const term = String(row.search_term || '').trim().toLowerCase();
    if (term.length < 2) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }

  const trending: TrendingTerm[] = Array.from(counts.entries())
    .map(([search_term, count]) => ({ search_term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TRENDING_TERMS);

  if (redis) {
    try {
      await redis.set(TRENDING_CACHE_KEY, JSON.stringify(trending), {
        ex: TRENDING_CACHE_TTL_SEC,
      });
    } catch {
      // ignore cache write errors
    }
  }

  return trending;
}

// ─── Core ordering function ───────────────────────────────────────────────────

/**
 * Build a personalized post ID ordering.
 *
 * Works for all cases:
 * - userTerms = []  → personal bucket empty → trending-first feed
 * - userTerms ≠ []  → personal bucket populated → fully personalized feed
 */
export function buildPersonalizedFeedOrder(
  rows: PersonalizedFeedRow[],
  feedSeed: string,
  userTerms: UserSearchTerm[],
  trendingTerms: TrendingTerm[],
): string[] {
  const cutoff24h = new Date(Date.now() - 86_400_000).toISOString();

  // Pre-expand terms once so we don't repeat work per post
  const expandedUser: ExpandedTerm[] = userTerms.map((ut) =>
    expandTerm(ut.search_term, ut.search_count),
  );
  const expandedTrending: ExpandedTerm[] = trendingTerms.map((tt) =>
    expandTerm(tt.search_term, 1),
  );

  // Buckets
  const boosted: PersonalizedFeedRow[] = [];
  const personal: ScoredRow[] = [];
  const trending: ScoredRow[] = [];
  const fresh: PersonalizedFeedRow[] = [];
  const regular: PersonalizedFeedRow[] = [];

  for (const row of rows) {
    const caption = row.caption || '';
    const isNew24h = !!(row.created_at && row.created_at >= cutoff24h);

    if (row.is_boosted) {
      boosted.push(row);
      continue;
    }

    // 1. Personal match
    if (expandedUser.length > 0) {
      let personalScore = 0;
      for (const exp of expandedUser) {
        if (captionMatchesExpanded(caption, exp)) personalScore += exp.weight;
      }
      if (personalScore > 0) {
        personal.push({ row, score: personalScore });
        continue;
      }
    }

    // 2. Trending match
    if (expandedTrending.length > 0) {
      let trendingScore = 0;
      for (const exp of expandedTrending) {
        if (captionMatchesExpanded(caption, exp)) trendingScore++;
      }
      if (trendingScore > 0) {
        trending.push({ row, score: trendingScore });
        continue;
      }
    }

    // 3. Fresh (< 24h)
    if (isNew24h) {
      fresh.push(row);
      continue;
    }

    // 4. Regular
    regular.push(row);
  }

  // Keep bucket priority, but randomize within bucket using feedSeed.
  // This makes refresh feel fresh while still respecting relevance ranking.
  const personalOrdered = sortScoredRowsWithSeed(personal, feedSeed);
  const trendingOrdered = sortScoredRowsWithSeed(trending, feedSeed);
  const freshOrdered = sortRowsWithSeed(fresh, feedSeed, 'fresh');

  // Regular posts: interleave by account for variety
  const regularOrdered = interleaveByAccount(regular, feedSeed);

  // Boosted posts: interleave by account for variety
  const boostedOrdered = interleaveByAccount(boosted, feedSeed).map((r) => r.id);

  // Merge non-boosted buckets in priority order
  const nonBoosted: string[] = [
    ...personalOrdered.map((s) => s.row.id),
    ...trendingOrdered.map((s) => s.row.id),
    ...freshOrdered.map((r) => r.id),
    ...regularOrdered.map((r) => r.id),
  ];

  // Interleave boosted every BOOST_INTERVAL positions
  return interleaveBoost(nonBoosted, boostedOrdered, BOOST_INTERVAL);
}
