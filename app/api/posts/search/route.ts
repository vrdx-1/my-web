import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { expandWithoutBrandAliases } from '@/utils/postUtils';

const SEARCH_LIMIT = 300;
const RPC_TERMS_LIMIT = 2500;

/**
 * GET /api/posts/search?q=...&province=...
 * ค้นหาโพสต์จาก caption: ขยายคำค้นเป็นกลุ่ม (ไทย/ลาว/อังกฤษ) แล้วแสดงโพสที่ caption มีคำใดคำหนึ่งในกลุ่ม
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
    const searchTerms = terms.length > RPC_TERMS_LIMIT ? terms.slice(0, RPC_TERMS_LIMIT) : terms;

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
      const { data: rpcRows, error: rpcError } = await supabase.rpc('search_cars_by_caption_terms', {
        p_terms: searchTerms,
        p_start: 0,
        p_limit: SEARCH_LIMIT,
      });

      if (rpcError) {
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
      }

      const ordered = (rpcRows || []) as { id: string; is_boosted: boolean | null; created_at: string }[];
      if (ordered.length === 0) {
        return NextResponse.json(
          { posts: [] },
          { headers: { 'Cache-Control': 'private, max-age=0' } }
        );
      }

      const ids = ordered.map((r) => r.id);
      const { data: rows, error: fetchError } = await supabase
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', ids);

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      const byId = new Map<string, any>();
      for (const p of rows || []) {
        if (p && p.status === 'recommend' && !p.is_hidden) byId.set(p.id, p);
      }

      const posts: any[] = [];
      for (const r of ordered) {
        const post = byId.get(r.id);
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
    let dbQuery = supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .eq('status', 'recommend')
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

    const posts = (data || []).filter((p: any) => p.status === 'recommend' && !p.is_hidden);

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
