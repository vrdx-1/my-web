import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type RepostClickEventRow = {
  id: string;
  post_id: string;
  user_id: string;
  clicked_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  name: string | null;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type CarRow = {
  id: string;
  short_id: string | null;
  caption: string | null;
  status: string | null;
};

function routeError(stage: string, err: unknown) {
  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  return NextResponse.json(
    {
      error: `Repost clicks API failed at ${stage}`,
      stage,
      message: anyErr?.message || 'Unknown error',
      code: anyErr?.code || null,
      details: anyErr?.details || null,
      hint: anyErr?.hint || null,
    },
    { status: 500 },
  );
}

async function ensureAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { ok: false, status: 401 as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }

  return { ok: true };
}

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

function personLabel(profile: ProfileRow | null, userId: string): string {
  const fullName = (profile?.full_name || profile?.display_name || profile?.name || '').trim();
  const username = (profile?.username || '').trim();
  if (fullName && username) return `${fullName} (@${username})`;
  if (fullName) return fullName;
  if (username) return `@${username}`;
  return `User ${userId.slice(0, 8)}`;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const { searchParams } = request.nextUrl;
    const postId = (searchParams.get('postId') || '').trim();
    const start = searchParams.get('start') || null;
    const end = searchParams.get('end') || null;
    const limitRaw = parseInt(searchParams.get('limit') || '5000', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(10000, Math.max(100, limitRaw)) : 5000;

    let query = admin
      .from('repost_click_events')
      .select('id, post_id, user_id, clicked_at')
      .order('clicked_at', { ascending: false })
      .limit(limit);

    if (postId) query = query.eq('post_id', postId);
    if (start) query = query.gte('clicked_at', new Date(start).toISOString());
    if (end) query = query.lte('clicked_at', new Date(end).toISOString());

    const { data: rawEvents, error: eventsError } = await query;
    if (eventsError) {
      return routeError('events_query', eventsError);
    }

    const events = ((rawEvents as RepostClickEventRow[] | null) || []).filter(Boolean);
    const userIds = Array.from(new Set(events.map((row) => row.user_id)));
    const postIds = Array.from(new Set(events.map((row) => row.post_id)));

    let profiles: ProfileRow[] = [];
    if (userIds.length > 0) {
      const { data: rawProfiles, error: profilesError } = await admin
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        return routeError('profiles_query', profilesError);
      }

      profiles = ((rawProfiles as Record<string, unknown>[] | null) || [])
        .map((row) => {
          const id = toStringOrNull(row.id);
          if (!id) return null;
          return {
            id,
            username: toStringOrNull(row.username) || toStringOrNull(row.user_name),
            full_name: toStringOrNull(row.full_name),
            display_name: toStringOrNull(row.display_name),
            name: toStringOrNull(row.name),
            role: toStringOrNull(row.role),
            is_sub_account: toBooleanOrNull(row.is_sub_account),
            parent_admin_id: toStringOrNull(row.parent_admin_id),
          };
        })
        .filter((row): row is ProfileRow => Boolean(row));
    }

    let cars: CarRow[] = [];
    if (postIds.length > 0) {
      const { data: rawCars, error: carsError } = await admin
        .from('cars')
        .select('id, short_id, caption, status')
        .in('id', postIds);

      if (carsError) {
        return routeError('cars_query', carsError);
      }

      cars = (rawCars as CarRow[] | null) || [];
    }

    const profileMap = new Map<string, ProfileRow>();
    profiles.forEach((profile) => profileMap.set(profile.id, profile));

    const carMap = new Map<string, CarRow>();
    cars.forEach((car) => carMap.set(car.id, car));

    const clicksByPost = new Map<string, { post_id: string; short_id: string | null; caption: string | null; status: string | null; total_clicks: number; last_clicked_at: string }>();
    const clicksByUser = new Map<string, { user_id: string; person_label: string; total_clicks: number; last_clicked_at: string }>();

    events.forEach((event) => {
      const car = carMap.get(event.post_id) || null;
      const postBucket = clicksByPost.get(event.post_id);
      if (!postBucket) {
        clicksByPost.set(event.post_id, {
          post_id: event.post_id,
          short_id: car?.short_id || null,
          caption: car?.caption || null,
          status: car?.status || null,
          total_clicks: 1,
          last_clicked_at: event.clicked_at,
        });
      } else {
        postBucket.total_clicks += 1;
        if (new Date(event.clicked_at) > new Date(postBucket.last_clicked_at)) {
          postBucket.last_clicked_at = event.clicked_at;
        }
      }

      const profile = profileMap.get(event.user_id) || null;
      const userBucket = clicksByUser.get(event.user_id);
      if (!userBucket) {
        clicksByUser.set(event.user_id, {
          user_id: event.user_id,
          person_label: personLabel(profile, event.user_id),
          total_clicks: 1,
          last_clicked_at: event.clicked_at,
        });
      } else {
        userBucket.total_clicks += 1;
        if (new Date(event.clicked_at) > new Date(userBucket.last_clicked_at)) {
          userBucket.last_clicked_at = event.clicked_at;
        }
      }
    });

    const posts = Array.from(clicksByPost.values()).sort((a, b) => {
      if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
      return new Date(b.last_clicked_at).getTime() - new Date(a.last_clicked_at).getTime();
    });

    const users = Array.from(clicksByUser.values()).sort((a, b) => {
      if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
      return new Date(b.last_clicked_at).getTime() - new Date(a.last_clicked_at).getTime();
    });

    return NextResponse.json({
      stats: {
        totalClicks: events.length,
        uniqueUsers: users.length,
        uniquePosts: posts.length,
      },
      posts,
      users,
      recentEvents: events.slice(0, 200),
    });
  } catch (error) {
    return routeError('unexpected', error);
  }
}
