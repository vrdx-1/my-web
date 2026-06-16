import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

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
  const fullName = (profile?.full_name || '').trim();
  const username = (profile?.username || '').trim();
  if (fullName && username) return `${fullName} (@${username})`;
  if (fullName) return fullName;
  if (username) return `@${username}`;
  return `User ${userId.slice(0, 8)}`;
}

function isNormalUser(profile: ProfileRow | null): boolean {
  if (!profile) return false;
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
      return internalServerError('admin/compare-usage logs query failed', logsError);
    }

    const logs = ((rawLogs as CompareUsageLogRow[] | null) || []).filter(Boolean);
    const userIds = Array.from(new Set(logs.map((row) => row.user_id)));
    const postIds = Array.from(new Set(logs.map((row) => row.post_id).filter((postId): postId is string => !!postId)));

    const [{ data: profiles, error: profilesError }, { data: cars, error: carsError }] = await Promise.all([
      userIds.length > 0
        ? admin
            .from('profiles')
            .select('id, username, full_name, avatar_url, role, is_sub_account, parent_admin_id')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length > 0
        ? admin
            .from('cars')
            .select('id, short_id, caption, price, price_currency, province')
            .in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesError) {
      return internalServerError('admin/compare-usage profiles query failed', profilesError);
    }
    if (carsError) {
      return internalServerError('admin/compare-usage cars query failed', carsError);
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of (profiles as ProfileRow[] | null) || []) {
      profileMap.set(profile.id, profile);
    }

    const carMap = new Map<string, CarRow>();
    for (const car of (cars as CarRow[] | null) || []) {
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
    });
  } catch (error) {
    return internalServerError('admin/compare-usage unexpected error', error);
  }
}