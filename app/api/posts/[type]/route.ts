import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';

/**
 * API Route for fetching posts by type (saved, liked, sold, my-posts)
 * GET /api/posts/[type]?startIndex=0&endIndex=9&userId=&tab=&status=
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

    if (currentUserId) {
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUserId);
    }

    let postIds: string[] = [];

    // Fetch post IDs based on type
    if (type === 'saved') {
      // Helper function to safely get idOrToken
      const getIdOrToken = (): string | null => {
        // ตรวจสอบ userIdOrToken ก่อน
        if (userIdOrToken && 
            userIdOrToken !== 'null' && 
            userIdOrToken !== 'undefined' && 
            userIdOrToken !== '' &&
            typeof userIdOrToken === 'string' &&
            userIdOrToken.length > 0 &&
            !userIdOrToken.includes('null')) {
          return userIdOrToken;
        }
        
        // ใช้ currentUserId (สำหรับ logged in user)
        if (currentUserId && 
            typeof currentUserId === 'string' &&
            currentUserId !== 'null' &&
            currentUserId !== 'undefined' &&
            currentUserId.length > 0 &&
            !currentUserId.includes('null')) {
          return currentUserId;
        }
        
        // ใช้ guest token เป็น fallback (สำหรับ guest user)
        try {
          const guestToken = getPrimaryGuestToken();
          if (guestToken && 
              guestToken !== 'null' && 
              guestToken !== 'undefined' && 
              guestToken !== '' &&
              typeof guestToken === 'string' &&
              guestToken.length > 0 &&
              !guestToken.includes('null')) {
            return guestToken;
          }
        } catch (err) {
          console.error('Error getting guest token:', err);
        }
        
        return null;
      };
      
      const idOrToken = getIdOrToken();
      
      if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
        console.warn('API: No valid idOrToken for saved posts', { userIdOrToken, currentUserId, type });
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      const isUser = !!currentUserId;
      const table = isUser ? 'post_saves' : 'post_saves_guest';
      const column = isUser ? 'user_id' : 'guest_token';
      
      console.log('API: Querying saved posts', { idOrToken, table, column, isUser, startIndex, endIndex });
      
      const { data: savesData, error: savesError } = await supabase
        .from(table)
        .select('post_id')
        .eq(column, idOrToken)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);
      
      if (savesError) {
        console.error('API: Error fetching saved posts:', savesError, { 
          idOrToken, 
          table, 
          column, 
          isUser,
          errorCode: savesError.code,
          errorMessage: savesError.message,
          errorDetails: savesError.details,
          errorHint: savesError.hint
        });
        return NextResponse.json({ posts: [], hasMore: false });
      }

      if (!savesData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      postIds = savesData
        .map(item => item.post_id)
        .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
    } else if (type === 'liked') {
      // Helper function to safely get idOrToken
      const getIdOrToken = (): string | null => {
        // ตรวจสอบ userIdOrToken ก่อน
        if (userIdOrToken && 
            userIdOrToken !== 'null' && 
            userIdOrToken !== 'undefined' && 
            userIdOrToken !== '' &&
            typeof userIdOrToken === 'string' &&
            userIdOrToken.length > 0 &&
            !userIdOrToken.includes('null')) {
          return userIdOrToken;
        }
        
        // ใช้ currentUserId (สำหรับ logged in user)
        if (currentUserId && 
            typeof currentUserId === 'string' &&
            currentUserId !== 'null' &&
            currentUserId !== 'undefined' &&
            currentUserId.length > 0 &&
            !currentUserId.includes('null')) {
          return currentUserId;
        }
        
        // ใช้ guest token เป็น fallback (สำหรับ guest user)
        try {
          const guestToken = getPrimaryGuestToken();
          if (guestToken && 
              guestToken !== 'null' && 
              guestToken !== 'undefined' && 
              guestToken !== '' &&
              typeof guestToken === 'string' &&
              guestToken.length > 0 &&
              !guestToken.includes('null')) {
            return guestToken;
          }
        } catch (err) {
          console.error('Error getting guest token:', err);
        }
        
        return null;
      };
      
      const idOrToken = getIdOrToken();
      
      if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
        console.warn('API: No valid idOrToken for liked posts', { userIdOrToken, currentUserId, type });
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      const isUser = !!currentUserId;
      const table = isUser ? 'post_likes' : 'post_likes_guest';
      const column = isUser ? 'user_id' : 'guest_token';
      
      console.log('API: Querying liked posts', { idOrToken, table, column, isUser, startIndex, endIndex });
      
      const { data: likesData, error: likesError } = await supabase
        .from(table)
        .select('post_id')
        .eq(column, idOrToken)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);
      
      if (likesError) {
        console.error('API: Error fetching liked posts:', likesError, { 
          idOrToken, 
          table, 
          column, 
          isUser,
          errorCode: likesError.code,
          errorMessage: likesError.message,
          errorDetails: likesError.details,
          errorHint: likesError.hint
        });
        return NextResponse.json({ posts: [], hasMore: false });
      }

      if (!likesData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      postIds = likesData
        .map(item => item.post_id)
        .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
    } else if (type === 'sold') {
      const { data, error } = await supabase
        .from('cars')
        .select('id')
        .eq('status', status || 'sold')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);
      if (error || !data) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      postIds = data.map(p => p.id);
    } else if (type === 'my-posts') {
      // Helper function to safely get idOrToken
      const getIdOrToken = (): string | null => {
        // ตรวจสอบ userIdOrToken ก่อน
        if (userIdOrToken && 
            userIdOrToken !== 'null' && 
            userIdOrToken !== 'undefined' && 
            userIdOrToken !== '' &&
            typeof userIdOrToken === 'string' &&
            userIdOrToken.length > 0 &&
            !userIdOrToken.includes('null')) {
          return userIdOrToken;
        }
        
        // ใช้ currentUserId (สำหรับ logged in user)
        if (currentUserId && 
            typeof currentUserId === 'string' &&
            currentUserId !== 'null' &&
            currentUserId !== 'undefined' &&
            currentUserId.length > 0 &&
            !currentUserId.includes('null')) {
          return currentUserId;
        }
        
        return null;
      };
      
      const idOrToken = getIdOrToken();
      
      if (!idOrToken || idOrToken === 'null' || idOrToken === 'undefined' || idOrToken === '' || typeof idOrToken !== 'string') {
        console.warn('API: No valid idOrToken for my-posts', { userIdOrToken, currentUserId, type });
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      console.log('API: Querying my-posts', { idOrToken, startIndex, endIndex, tab });
      
      const { data: idsData, error: idsError } = await supabase
        .from('cars')
        .select('id')
        .eq('user_id', idOrToken)
        .eq('status', tab || 'recommend')
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);
      
      if (idsError) {
        console.error('API: Error fetching my-posts:', idsError, { 
          idOrToken,
          errorCode: idsError.code,
          errorMessage: idsError.message,
          errorDetails: idsError.details,
          errorHint: idsError.hint
        });
        return NextResponse.json({ posts: [], hasMore: false });
      }

      if (!idsData) {
        return NextResponse.json({ posts: [], hasMore: false });
      }
      
      postIds = idsData
        .map(p => p.id)
        .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่า postIds ไม่มี null หรือ undefined
    const validPostIds = postIds.filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string');
    
    if (validPostIds.length === 0) {
      console.warn('API: No valid postIds after filtering', { postIds, type });
      return NextResponse.json({ posts: [], hasMore: false });
    }
    
    console.log('API: Fetching posts', { 
      postIdsCount: postIds.length, 
      validPostIdsCount: validPostIds.length,
      type 
    });

    // Fetch full post data
    const { data: postsData, error: postsError } = await supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('id', validPostIds)
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('API: Error fetching posts:', postsError, { 
        validPostIds,
        validPostIdsCount: validPostIds.length,
        type,
        errorCode: postsError.code,
        errorMessage: postsError.message,
        errorDetails: postsError.details,
        errorHint: postsError.hint
      });
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
