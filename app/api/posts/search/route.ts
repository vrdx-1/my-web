import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import {
  expandWithoutBrandAliases,
  getSearchPriorityTerms,
  captionContainsPriorityTerm,
  captionMatchesAnyAlias,
  captionMatchesCategoryWithBrand,
  getSearchCategoryIds,
  getStrictBrandSearchTerms,
} from '@/utils/postUtils';
import { extractYearsFromQuery, removeYearsFromQuery, removePartialYearSuffix } from '@/utils/yearSearchUtils';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

const SEARCH_LIMIT = 1000;
/** จำนวนคำค้นต่อ 1 ครั้งเรียก RPC — แบ่ง batch เพื่อไม่ให้ request ล้ม */
const RPC_TERMS_PER_CALL = 500;
/** สแกนโพสต์เพิ่มเฉพาะตอนค้นหา category เพื่อให้ match ด้วย dictionary/typo tolerance ได้ */
const CATEGORY_SEARCH_SCAN_LIMIT = 5000;

/** รูปแบบรหัสโพส 6 ตัว: ตัวเลขล้วน */
const SHORT_ID_REGEX = /^[0-9]{6}$/;

type SearchPostRow = {
  id: string;
  caption: string;
  status: 'recommend' | 'sold' | string;
  is_hidden: boolean | null;
  province?: string | null;
  is_boosted?: boolean | null;
  created_at: string;
};

/** ใช้ดึงโพสจาก cars โดยข้าม RLS — ถ้าไม่มี key จะใช้ client ปกติ */
function getCarsReadClient(supabase: ReturnType<typeof createServerClient>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return supabase;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false } }
  );
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sortBySeed<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items].sort((left, right) => {
    const diff = hashString(`${seed}:post:${left.id}`) - hashString(`${seed}:post:${right.id}`);
    if (diff !== 0) return diff;
    return String(left.id).localeCompare(String(right.id));
  });
}

function orderSearchPosts(posts: SearchPostRow[], queryYears: number[], seed: string): SearchPostRow[] {
  if (queryYears.length === 0) return sortBySeed(posts, seed);

  const queryYearSet = new Set(queryYears);
  const exactYearMatches: SearchPostRow[] = [];
  const nonMatchingYears: SearchPostRow[] = [];

  for (const post of posts) {
    const postYears = extractYearsFromQuery(post.caption);
    const hasExactMatch = postYears.some((year) => queryYearSet.has(year));
    if (hasExactMatch) exactYearMatches.push(post);
    else nonMatchingYears.push(post);
  }

  return [...exactYearMatches, ...sortBySeed(nonMatchingYears, seed)];
}

/**
 * GET /api/posts/search?q=...&province=...
 * ค้นหาโพสต์จาก caption: ขยายคำค้นเป็นกลุ่ม (ไทย/ลาว/อังกฤษ) แล้วแสดงโพสที่ caption มีคำใดคำหนึ่งในกลุ่ม
 * หมายเหตุ: ถ้าค้นช้า ควรเพิ่มดัชนี (index) บนคอลัมน์ caption เช่น pg_trgm สำหรับ ILIKE
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:search',
      identifier: ip,
      limit: 60,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') ?? '';
    const province = searchParams.get('province') ?? undefined;
    const query = (typeof q === 'string' ? q : '').trim();
    const searchSeed = randomUUID();
    const queryYears = extractYearsFromQuery(query);
    // Strip full years ("Revo2010" → "Revo") then strip leftover partial suffix ("revo20" → "revo")
    const queryForMatching = queryYears.length > 0
      ? (removePartialYearSuffix(removeYearsFromQuery(query)).trim() || query)
      : removePartialYearSuffix(query).trim() || query;
    if (query.length === 0) {
      return NextResponse.json(
        { posts: [] },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    const terms = expandWithoutBrandAliases(queryForMatching)
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);
    // ถ้าค้นหาแบรนด์แบบ strict (เช่น Nissan/ນີດສັນ/นิสสัน) ให้ใช้เฉพาะ alias แบรนด์นั้น
    // ไม่ขยายไปรุ่น เพื่อให้แสดงเฉพาะโพสที่มีชื่อแบรนด์จริง ๆ ใน caption
    const strictBrandTerms = getStrictBrandSearchTerms(queryForMatching);
    const searchTerms = strictBrandTerms
      ? strictBrandTerms.map((t) => String(t ?? '').trim()).filter(Boolean)
      : terms;
    const matchedCategoryIds = getSearchCategoryIds(queryForMatching);

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
    const carsClient = getCarsReadClient(supabase);

    if (matchedCategoryIds.length > 0) {
      let categoryQuery = carsClient
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('status', ['recommend', 'sold'])
        .eq('is_hidden', false);

      if (province && province.trim() !== '') {
        categoryQuery = categoryQuery.eq('province', province.trim());
      }

      const { data: categoryRows, error: categoryError } = await categoryQuery
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(CATEGORY_SEARCH_SCAN_LIMIT);

      if (categoryError) {
        return internalServerError('posts/search category query failed', categoryError);
      }

      let posts = (categoryRows || []).filter(
        (post: SearchPostRow) =>
          (post.status === 'recommend' || post.status === 'sold') &&
          !post.is_hidden &&
          captionMatchesCategoryWithBrand(post.caption, matchedCategoryIds),
      ) as SearchPostRow[];

      const priorityTerms = getSearchPriorityTerms(queryForMatching);
      if (queryYears.length > 0 && priorityTerms.length > 0) {
        posts = [...posts].sort((a, b) => {
          const aHas = captionContainsPriorityTerm(a.caption, priorityTerms) ? 1 : 0;
          const bHas = captionContainsPriorityTerm(b.caption, priorityTerms) ? 1 : 0;
          if (bHas !== aHas) return bHas - aHas;
          const aBoost = a.is_boosted === true ? 1 : 0;
          const bBoost = b.is_boosted === true ? 1 : 0;
          if (bBoost !== aBoost) return bBoost - aBoost;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      posts = orderSearchPosts(posts, queryYears, searchSeed);

      return NextResponse.json(
        { posts: posts.slice(0, SEARCH_LIMIT) },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    if (searchTerms.length > 1) {
      type RpcRow = { id: string; is_boosted: boolean | null; created_at: string };
      const allOrdered: RpcRow[] = [];
      const seenIds = new Set<string>();

      if (searchTerms.length <= RPC_TERMS_PER_CALL) {
        const { data: rpcRows, error: rpcError } = await supabase.rpc('search_cars_by_caption_terms', {
          p_terms: searchTerms,
          p_start: 0,
          p_limit: SEARCH_LIMIT,
        });
        if (rpcError) {
          return internalServerError('posts/search rpc failed', rpcError);
        }
        for (const r of (rpcRows || []) as RpcRow[]) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allOrdered.push(r);
          }
        }
      } else {
        for (let i = 0; i < searchTerms.length; i += RPC_TERMS_PER_CALL) {
          const chunk = searchTerms.slice(i, i + RPC_TERMS_PER_CALL);
          const { data: rpcRows, error: rpcError } = await supabase.rpc('search_cars_by_caption_terms', {
            p_terms: chunk,
            p_start: 0,
            p_limit: SEARCH_LIMIT,
          });
          if (rpcError) {
            return internalServerError('posts/search rpc chunk failed', rpcError);
          }
          for (const r of (rpcRows || []) as RpcRow[]) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              allOrdered.push(r);
            }
          }
        }
      }

      // โพสที่ short_id ตรงกับคำค้นใดคำหนึ่ง (คำค้นต้องเป็นรูปแบบตัวเลข 6 ตัว) — นำมารวมกับผลจาก caption
      const shortIdTerms = searchTerms.filter((t) => SHORT_ID_REGEX.test(t));
      if (shortIdTerms.length > 0) {
        const { data: shortRows } = await carsClient
          .from('cars')
          .select('id, is_boosted, created_at')
          .in('short_id', shortIdTerms)
          .in('status', ['recommend', 'sold'])
          .eq('is_hidden', false);
        for (const r of shortRows || []) {
          if (r && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            allOrdered.push({ id: r.id, is_boosted: r.is_boosted ?? null, created_at: r.created_at });
          }
        }
      }

      const topIds = sortBySeed(allOrdered, searchSeed).slice(0, SEARCH_LIMIT).map((r) => r.id);
      if (topIds.length === 0) {
        return NextResponse.json(
          { posts: [] },
          { headers: { 'Cache-Control': 'private, max-age=0' } }
        );
      }

      const { data: rows, error: fetchError } = await carsClient
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', topIds);

      if (fetchError) {
        return internalServerError('posts/search fetch rows failed', fetchError);
      }

      const byId = new Map<string, SearchPostRow>();
      for (const p of rows || []) {
        if (p && (p.status === 'recommend' || p.status === 'sold') && !p.is_hidden) byId.set(p.id, p);
      }

      let posts: SearchPostRow[] = [];
      for (const id of topIds) {
        const post = byId.get(id);
        if (!post) continue;
        if (province && province.trim() !== '' && post.province !== province.trim()) continue;
        posts.push(post);
      }

      // Extract years from query for ranking
      const queryYears = extractYearsFromQuery(query);

      // จัดเรียงตามความเกี่ยวข้องเฉพาะตอนค้นหาปี เพื่อให้ปีที่ตรงยังอยู่ด้านบนเหมือนเดิม
      const priorityTerms = getSearchPriorityTerms(queryForMatching);
      if (queryYears.length > 0 && priorityTerms.length > 0) {
        posts.sort((a, b) => {
          const aHas = captionContainsPriorityTerm(a.caption, priorityTerms) ? 1 : 0;
          const bHas = captionContainsPriorityTerm(b.caption, priorityTerms) ? 1 : 0;
          if (bHas !== aHas) return bHas - aHas;
          const aBoost = a.is_boosted === true ? 1 : 0;
          const bBoost = b.is_boosted === true ? 1 : 0;
          if (bBoost !== aBoost) return bBoost - aBoost;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      posts = orderSearchPosts(posts, queryYears, searchSeed);

      return NextResponse.json(
        { posts },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    const singleQuery = searchTerms[0] ?? queryForMatching;
    const matchShortId = SHORT_ID_REGEX.test(singleQuery);
    let dbQuery = carsClient
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('status', ['recommend', 'sold'])
      .eq('is_hidden', false);
    if (matchShortId) {
      dbQuery = dbQuery.or(`caption.ilike.%${singleQuery}%,short_id.eq.${singleQuery}`);
    } else {
      dbQuery = dbQuery.ilike('caption', `%${singleQuery}%`);
    }

    if (province && province.trim() !== '') {
      dbQuery = dbQuery.eq('province', province.trim());
    }

    const { data, error } = await dbQuery
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT);

    if (error) {
      return internalServerError('posts/search single query failed', error);
    }

    let posts = (data || []).filter(
      (p: SearchPostRow) => (p.status === 'recommend' || p.status === 'sold') && !p.is_hidden,
    ) as SearchPostRow[];

    const priorityTerms = getSearchPriorityTerms(queryForMatching);
    if (queryYears.length > 0 && priorityTerms.length > 0) {
      posts = [...posts].sort((a, b) => {
        const aHas = captionContainsPriorityTerm(a.caption, priorityTerms) ? 1 : 0;
        const bHas = captionContainsPriorityTerm(b.caption, priorityTerms) ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        const aBoost = a.is_boosted === true ? 1 : 0;
        const bBoost = b.is_boosted === true ? 1 : 0;
        if (bBoost !== aBoost) return bBoost - aBoost;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    posts = orderSearchPosts(posts, queryYears, searchSeed);

    return NextResponse.json(
      { posts },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err) {
    return internalServerError('posts/search unexpected error', err);
  }
}
