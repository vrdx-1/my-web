import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { FEED_PAGE_SIZE } from '@/utils/constants';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';

/** อัปเดต last_seen ของ user ที่ล็อกอินอยู่ เพื่อให้สถานะออนไลน์แสดงถูกต้องเมื่อโหลด feed */
async function touchLastSeen(supabase: ReturnType<typeof createServerClient>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
    }
  } catch (_) {
    // ไม่บล็อก feed ถ้าอัปเดต last_seen ล้มเหลว
  }
}

function runFeedQuery(
  supabase: ReturnType<typeof createServerClient>,
  startIndex: number,
  endIndex: number,
  province?: string
) {
  // รวมโพสต์ที่ is_hidden = false หรือ is_hidden IS NULL (โพสต์ใหม่ที่ยังไม่ได้ตั้งค่า)
  let query = supabase
    .from('cars')
    .select('id')
    .eq('status', 'recommend')
    .or('is_hidden.eq.false,is_hidden.is.null');
  if (province && province.trim() !== '') {
    query = query.eq('province', province.trim());
  }
  return query
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);
}

/**
 * POST /api/posts/feed — body: { startIndex, endIndex, province? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const startIndex = parseInt(String(body.startIndex ?? 0), 10);
    const endIndex = parseInt(String(body.endIndex ?? FEED_PAGE_SIZE - 1), 10);
    const province = typeof body.province === 'string' ? body.province : undefined;

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

    await touchLastSeen(supabase);

    const requestedPageLen = Math.max(0, endIndex - startIndex + 1);
    let postIds: string[];

    // หลัง refresh ใช้ลำดับ Algorithm เท่านั้น; โพสต์ที่เพิ่งสร้างจะถูกแปะบนสุดฝั่ง client (just_posted_post_id)
    const { data, error } = await runFeedQuery(supabase, startIndex, endIndex, province);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    postIds = (data || []).map((p: { id: string }) => p.id);

    const hasMore = requestedPageLen > 0 && postIds.length >= requestedPageLen;

    let posts: any[] | undefined;
    if (postIds.length > 0) {
      const { data: postsData, error: postsErr } = await supabase
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', postIds);
      if (!postsErr && postsData?.length) {
        const order = new Map(postIds.map((id, i) => [String(id), i]));
        const filtered = postsData.filter((p: any) => p.status === 'recommend' && !p.is_hidden);
        filtered.sort((a: any, b: any) => {
          const ai = order.get(String(a.id)) ?? 1e9;
          const bi = order.get(String(b.id)) ?? 1e9;
          return ai - bi;
        });
        posts = filtered;
      }
    }

    return NextResponse.json(
      { postIds, hasMore, posts },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
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

    await touchLastSeen(supabase);

    const requestedPageLen = Math.max(0, endIndex - startIndex + 1);
    const { data, error } = await runFeedQuery(supabase, startIndex, endIndex, province);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const postIds = (data || []).map((p: { id: string }) => p.id);
    const hasMore = requestedPageLen > 0 && postIds.length >= requestedPageLen;

    let posts: any[] | undefined;
    if (postIds.length > 0) {
      const { data: postsData, error: postsErr } = await supabase
        .from('cars')
        .select(POST_WITH_PROFILE_SELECT)
        .in('id', postIds);
      if (!postsErr && postsData?.length) {
        const order = new Map(postIds.map((id, i) => [String(id), i]));
        const filtered = postsData.filter((p: any) => p.status === 'recommend' && !p.is_hidden);
        filtered.sort((a: any, b: any) => {
          const ai = order.get(String(a.id)) ?? 1e9;
          const bi = order.get(String(b.id)) ?? 1e9;
          return ai - bi;
        });
        posts = filtered;
      }
    }

    return NextResponse.json(
      { postIds, hasMore, posts },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err: any) {
    console.error('API /api/posts/feed GET:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
