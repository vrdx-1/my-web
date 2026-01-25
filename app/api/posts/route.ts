import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';

/**
 * API Route for fetching posts with caching support
 * GET /api/posts?startIndex=0&endIndex=9&searchTerm=
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    const endIndex = parseInt(searchParams.get('endIndex') || '9');
    const searchTerm = searchParams.get('searchTerm') || '';

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

    // Build query
    let query = supabase
      .from('cars')
      .select('id')
      .eq('status', 'recommend')
      .eq('is_hidden', false)
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startIndex, endIndex);

    // Add search filter if provided
    if (searchTerm) {
      query = query.ilike('province', `%${searchTerm}%`);
    }

    const { data: idsData, error: idsError } = await query;

    if (idsError) {
      return NextResponse.json(
        { error: idsError.message },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: postsError.message },
        { status: 500 }
      );
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
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
