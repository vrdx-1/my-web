import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';

/**
 * API Route for fetching posts by type (saved, liked, sold, my-posts)
 * GET /api/posts/[type]?startIndex=0&endIndex=9&userId=&tab=&searchTerm=&status=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const searchParams = request.nextUrl.searchParams;
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    const endIndex = parseInt(searchParams.get('endIndex') || '9');
    const userIdOrToken = searchParams.get('userId') || '';
    const tab = searchParams.get('tab') || '';
    const searchTerm = searchParams.get('searchTerm') || '';
    const status = searchParams.get('status') || '';

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

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    let postIds: string[] = [];

    // Fetch post IDs based on type
    if (type === 'saved') {
      const idOrToken = userIdOrToken || currentUserId || getPrimaryGuestToken();
      const { data: savesData, error: savesError } = await supabase
        .from('post_saves')
        .select('post_id')
        .eq('user_id', idOrToken)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (savesError || !savesData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      postIds = savesData.map(item => item.post_id);
    } else if (type === 'liked') {
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userIdOrToken || currentUserId || '')
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (likesError || !likesData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      postIds = likesData.map(item => item.post_id);
    } else if (type === 'sold') {
      let query = supabase
        .from('cars')
        .select('id')
        .eq('status', status || 'sold')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (searchTerm) {
        query = query.ilike('caption', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error || !data) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      postIds = data.map(p => p.id);
    } else if (type === 'my-posts') {
      const { data: idsData, error: idsError } = await supabase
        .from('cars')
        .select('id')
        .eq('user_id', userIdOrToken || currentUserId || '')
        .eq('status', tab || 'recommend')
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (idsError || !idsData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      postIds = idsData.map(p => p.id);
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    if (postIds.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false });
    }

    // Fetch full post data
    const { data: postsData, error: postsError } = await supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('id', postIds)
      .order('created_at', { ascending: false });

    if (postsError) {
      return NextResponse.json(
        { error: postsError.message },
        { status: 500 }
      );
    }

    // Filter posts for saved/liked types
    let filteredPosts = postsData || [];
    if (type === 'saved' || type === 'liked') {
      filteredPosts = filteredPosts.filter(post => {
        const isNotHidden = !post.is_hidden;
        const isOwner = currentUserId && post.user_id === currentUserId;
        const matchesTab = tab ? post.status === tab : true;
        return matchesTab && (isNotHidden || isOwner);
      });
    }

    const hasMore = postIds.length === PREFETCH_COUNT;

    return NextResponse.json({
      posts: filteredPosts,
      hasMore,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
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
