import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { PREFETCH_COUNT } from '@/utils/constants';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

/**
 * API Route for fetching posts with caching support
 * GET /api/posts?startIndex=0&endIndex=9
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:list',
      identifier: ip,
      limit: 120,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    const endIndex = parseInt(searchParams.get('endIndex') || '9');

    // Create Supabase client
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

    const { data: idsData, error: idsError } = await supabase
      .from('cars')
      .select('id')
      .eq('status', 'recommend')
      .eq('is_hidden', false)
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startIndex, endIndex);

    if (idsError) {
      return internalServerError('posts list ids failed', idsError);
    }

    if (!idsData || idsData.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false });
    }

    const postIds = idsData.map(p => p.id);

    // Fetch full post data
    const { data: postsData, error: postsError } = await supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('id', postIds)
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false });

    if (postsError) {
      return internalServerError('posts list rows failed', postsError);
    }

    const hasMore = postIds.length === PREFETCH_COUNT;

    return NextResponse.json({
      posts: postsData || [],
      hasMore,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return internalServerError('posts list unexpected error', error);
  }
}
