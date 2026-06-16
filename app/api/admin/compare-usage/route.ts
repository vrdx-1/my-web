import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type CompareUsageLogRow = {
  id: string;
  user_id: string;
  post_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type CarRow = {
  id: string;
  short_id: string | null;
  caption: string | null;
  price: number | null;
  price_currency: string | null;
  province: string | null;
};

type CarRowFallback = {
  id: string;
  short_id: string | null;
  caption: string | null;
  price: number | null;
  province: string | null;
};

function routeError(stage: string, err: unknown) {
  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  return NextResponse.json(
    {
      error: `Compare usage API failed at ${stage}`,
      stage,
      message: anyErr?.message || 'Unknown error',
      code: anyErr?.code || null,
      details: anyErr?.details || null,
      hint: anyErr?.hint || null,
    },
    { status: 500 }
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
    }
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
    { auth: { persistSession: false } }
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

function isNormalUser(profile: ProfileRow | null): boolean {
  // If profile lookup is unavailable in this environment, keep rows visible.
  // Admin/sub-account actors are already filtered at insert-time.
  if (!profile) return true;
  if (profile.role === 'admin') return false;
  if (profile.is_sub_account && profile.parent_admin_id) return false;
  return true;
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
    const start = searchParams.get('start') || null;
    const end = searchParams.get('end') || null;
    const limitRaw = parseInt(searchParams.get('limit') || '5000', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(10000, Math.max(100, limitRaw)) : 5000;

    let logsQuery = admin
      .from('compare_usage_logs')
      .select('id, user_id, post_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start) logsQuery = logsQuery.gte('created_at', new Date(start).toISOString());
    if (end) logsQuery = logsQuery.lte('created_at', new Date(end).toISOString());

    const { data: rawLogs, error: logsError } = await logsQuery;
    if (logsError) {
      return routeError('logs_query', logsError);
    }

    const logs = ((rawLogs as CompareUsageLogRow[] | null) || []).filter(Boolean);
    const userIds = Array.from(new Set(logs.map((row) => row.user_id)));
    const postIds = Array.from(new Set(logs.map((row) => row.post_id).filter((postId): postId is string => !!postId)));

    let profiles: ProfileRow[] = [];
    let profilesLookupWarning: string | null = null;
    if (userIds.length > 0) {
      const { data: rawProfiles, error: profilesError } = await admin
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (!profilesError) {
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
              avatar_url: toStringOrNull(row.avatar_url) || toStringOrNull(row.avatar),
              role: toStringOrNull(row.role),
              is_sub_account: toBooleanOrNull(row.is_sub_account),
              parent_admin_id: toStringOrNull(row.parent_admin_id),
            };
          })
          .filter((row): row is ProfileRow => Boolean(row));
      } else {
        profilesLookupWarning = `profiles_query_failed: ${profilesError.message || 'unknown error'}`;
        profiles = [];
      }
    }

    let cars: CarRow[] = [];
    if (postIds.length > 0) {
      const { data: fullCars, error: fullCarsError } = await admin
        .from('cars')
        .select('id, short_id, caption, price, price_currency, province')
        .in('id', postIds);

      if (!fullCarsError) {
        cars = (fullCars as CarRow[] | null) || [];
      } else {
        const { data: fallbackCars, error: fallbackCarsError } = await admin
          .from('cars')
          .select('id, short_id, caption, price, province')
          .in('id', postIds);

        if (fallbackCarsError) {
          return routeError('cars_query', fallbackCarsError);
        }

        cars = ((fallbackCars as CarRowFallback[] | null) || []).map((row) => ({
          id: row.id,
          short_id: row.short_id,
          caption: row.caption,
          price: row.price,
          price_currency: null,
          province: row.province,
        }));
      }
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of profiles) {
      profileMap.set(profile.id, profile);
    }

    const carMap = new Map<string, CarRow>();
    for (const car of cars) {
      carMap.set(car.id, car);
    }

    const visibleLogs = logs
      .map((row) => {
        const profile = profileMap.get(row.user_id) || null;
        if (!isNormalUser(profile)) return null;
        const car = row.post_id ? (carMap.get(row.post_id) || null) : null;
        return {
          id: row.id,
          created_at: row.created_at,
          user_id: row.user_id,
          person_key: `user:${row.user_id}`,
          person_label: personLabel(profile, row.user_id),
          person_type: 'user' as const,
          post_id: row.post_id,
          post_short_id: car?.short_id || null,
          caption: car?.caption || null,
          price: car?.price || null,
          price_currency: car?.price_currency || null,
          province: car?.province || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const peopleMap = new Map<string, {
      person_key: string;
      person_label: string;
      person_type: 'user';
      avatar_url: string | null;
      total_compare_clicks: number;
      last_clicked_at: string;
    }>();

    for (const row of visibleLogs) {
      const profile = profileMap.get(row.user_id) || null;
      const existing = peopleMap.get(row.person_key);
      if (!existing) {
        peopleMap.set(row.person_key, {
          person_key: row.person_key,
          person_label: row.person_label,
          person_type: 'user',
          avatar_url: profile?.avatar_url || null,
          total_compare_clicks: 1,
          last_clicked_at: row.created_at,
        });
      } else {
        existing.total_compare_clicks += 1;
        if (new Date(row.created_at) > new Date(existing.last_clicked_at)) {
          existing.last_clicked_at = row.created_at;
        }
      }
    }

    const people = Array.from(peopleMap.values()).sort((a, b) => {
      if (b.total_compare_clicks !== a.total_compare_clicks) return b.total_compare_clicks - a.total_compare_clicks;
      return new Date(b.last_clicked_at).getTime() - new Date(a.last_clicked_at).getTime();
    });

    const totalClicks = visibleLogs.length;
    const uniqueUsers = people.length;
    const uniquePosts = new Set(visibleLogs.map((row) => row.post_id).filter((postId): postId is string => !!postId)).size;
    const avgClicksPerUser = uniqueUsers > 0 ? totalClicks / uniqueUsers : 0;

    const recentLogs = visibleLogs.slice(0, 200);

    return NextResponse.json({
      stats: {
        totalClicks,
        uniqueUsers,
        uniquePosts,
        avgClicksPerUser,
      },
      people,
      recentLogs,
      warnings: profilesLookupWarning ? [profilesLookupWarning] : [],
    });
  } catch (error) {
    return routeError('unexpected', error);
  }
}