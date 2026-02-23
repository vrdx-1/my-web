import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';

const SEARCH_LIMIT = 100;

/**
 * GET /api/posts/search?q=...&province=...
 * ค้นหาโพสต์จาก caption (ilike), optional filter ตาม province
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

    let dbQuery = supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .eq('status', 'recommend')
      .eq('is_hidden', false);

    dbQuery = dbQuery.ilike('caption', `%${query}%`);
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
