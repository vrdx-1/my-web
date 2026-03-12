import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { expandWithoutBrandAliases } from '@/utils/postUtils';

const SEARCH_LIMIT = 1000;
/** จำนวนคำค้นต่อ 1 ครั้งเรียก RPC — แบ่ง batch เพื่อไม่ให้ request ล้ม */
const RPC_TERMS_PER_CALL = 500;

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

/**
 * GET /api/posts/search?q=...&province=...
 * ค้นหาโพสต์จาก caption: ขยายคำค้นเป็นกลุ่ม (ไทย/ลาว/อังกฤษ) แล้วแสดงโพสที่ caption มีคำใดคำหนึ่งในกลุ่ม
 * หมายเหตุ: ถ้าค้นช้า ควรเพิ่มดัชนี (index) บนคอลัมน์ caption เช่น pg_trgm สำหรับ ILIKE
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') ?? '';
    const province = searchParams.get('province') ?? undefined;
    const query = (typeof q === 'string' ? q : '').trim();
    if (query.length === 0) {
      return NextResponse.json(
        { posts: [] },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    const terms = expandWithoutBrandAliases(query)
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);
    const searchTerms = terms;

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
          return NextResponse.json({ error: rpcError.message }, { status: 500 });
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
            return NextResponse.json({ error: rpcError.message }, { status: 500 });
          }
          for (const r of (rpcRows || []) as RpcRow[]) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              allOrdered.push(r);
            }
          }
        }
      }

      allOrdered.sort((a, b) => {
        const aBoost = a.is_boosted === true ? 1 : 0;
        const bBoost = b.is_boosted === true ? 1 : 0;
        if (bBoost !== aBoost) return bBoost - aBoost;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const topIds = allOrdered.slice(0, SEARCH_LIMIT).map((r) => r.id);
      if (topIds.length === 0) {
        return NextResponse.json(
          { posts: [] },
          { headers: { 'Cache-Control': 'private, max-age=0' } }
        );
      }

      const carsClient = getCarsReadClient(supabase);
      const { data: rows, error: fetchError } = await carsClient
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', topIds);

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      const byId = new Map<string, any>();
      for (const p of rows || []) {
        if (p && (p.status === 'recommend' || p.status === 'sold') && !p.is_hidden) byId.set(p.id, p);
      }

      const posts: any[] = [];
      for (const id of topIds) {
        const post = byId.get(id);
        if (!post) continue;
        if (province && province.trim() !== '' && post.province !== province.trim()) continue;
        posts.push(post);
      }

      return NextResponse.json(
        { posts },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    const singleQuery = searchTerms[0] ?? query;
    const carsClient = getCarsReadClient(supabase);
    let dbQuery = carsClient
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('status', ['recommend', 'sold'])
      .eq('is_hidden', false)
      .ilike('caption', `%${singleQuery}%`);

    if (province && province.trim() !== '') {
      dbQuery = dbQuery.eq('province', province.trim());
    }

    const { data, error } = await dbQuery
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const posts = (data || []).filter((p: any) => (p.status === 'recommend' || p.status === 'sold') && !p.is_hidden);

    return NextResponse.json(
      { posts },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err: any) {
    console.error('API /api/posts/search GET:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
