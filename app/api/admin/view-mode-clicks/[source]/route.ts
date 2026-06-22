import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';
import { isViewModeAnalyticsSource, VIEW_MODE_ANALYTICS_CONFIG } from '@/utils/viewModeClickAnalytics';

type ClickRow = {
  id: string;
  user_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  role: string | null;
  is_sub_account: boolean | null;
};

type PersonSummary = {
  user_id: string;
  person_label: string;
  total_clicks: number;
  last_clicked_at: string;
};

type HistoryItem = {
  id: string;
  user_id: string;
  person_label: string;
  created_at: string;
};

const PAGE_SIZE = 1000;

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

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function personLabel(profile: ProfileRow | null, userId: string) {
  const username = (profile?.username || '').trim();
  if (username) return `@${username}`;
  return `User ${userId.slice(0, 8)}`;
}

function bangkokDateString(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function fetchRows(admin: AdminClient, tableName: string, startIso: string | null, endIso: string | null, limit: number) {
  const rows: ClickRow[] = [];
  let from = 0;

  for (;;) {
    const to = Math.min(from + PAGE_SIZE - 1, limit - 1);
    let query = admin
      .from(tableName)
      .select('id, user_id, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (startIso) query = query.gte('created_at', startIso);
    if (endIso) query = query.lte('created_at', endIso);

    const { data, error } = await query;
    if (error) return { rows: null, error };

    const pageRows = (data || []) as ClickRow[];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE || rows.length >= limit) break;
    from += PAGE_SIZE;
  }

  return { rows, error: null };
}

export async function GET(request: NextRequest, context: { params: Promise<{ source: string }> }) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { source } = await context.params;
  if (!isViewModeAnalyticsSource(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || null;
  const end = searchParams.get('end') || null;
  const selectedUserId = (searchParams.get('userId') || '').trim();
  const limitRaw = parseInt(searchParams.get('limit') || '5000', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(10000, Math.max(100, limitRaw)) : 5000;

  const tableName = VIEW_MODE_ANALYTICS_CONFIG[source].tableName;
  const rowRes = await fetchRows(admin, tableName, start, end, limit);
  if (rowRes.error) {
    return internalServerError(`admin/view-mode-clicks/${source} query failed`, rowRes.error);
  }

  const clickRows = (rowRes.rows || []).filter((row) => Boolean(row.user_id));
  const userIds = Array.from(new Set(clickRows.map((row) => row.user_id)));

  const profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await admin
      .from('profiles')
      .select('id, username, role, is_sub_account')
      .in('id', userIds);

    if (profileError) {
      return internalServerError(`admin/view-mode-clicks/${source} profile query failed`, profileError);
    }

    for (const row of (profileRows as ProfileRow[] | null) || []) {
      profileMap.set(row.id, row);
    }
  }

  const normalizedRows = clickRows
    .map((row) => {
      const profile = profileMap.get(row.user_id) || null;
      if (profile?.role === 'admin' || profile?.is_sub_account) return null;
      return {
        ...row,
        person_label: personLabel(profile, row.user_id),
      };
    })
    .filter((row): row is HistoryItem => Boolean(row));

  const peopleMap = new Map<string, PersonSummary>();
  for (const row of normalizedRows) {
    const existing = peopleMap.get(row.user_id);
    if (!existing) {
      peopleMap.set(row.user_id, {
        user_id: row.user_id,
        person_label: row.person_label,
        total_clicks: 1,
        last_clicked_at: row.created_at,
      });
      continue;
    }

    existing.total_clicks += 1;
    if (new Date(row.created_at).getTime() > new Date(existing.last_clicked_at).getTime()) {
      existing.last_clicked_at = row.created_at;
    }
  }

  const people = Array.from(peopleMap.values()).sort((a, b) => {
    if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
    return new Date(b.last_clicked_at).getTime() - new Date(a.last_clicked_at).getTime();
  });

  const history = selectedUserId ? normalizedRows.filter((row) => row.user_id === selectedUserId) : [];
  const selectedUser = selectedUserId
    ? {
        user_id: selectedUserId,
        person_label: peopleMap.get(selectedUserId)?.person_label || personLabel(profileMap.get(selectedUserId) || null, selectedUserId),
        total_clicks: history.length,
      }
    : null;

  const today = bangkokDateString(new Date());

  const stats = {
    totalClicks: normalizedRows.length,
    uniqueUsers: people.length,
    todayClicks: normalizedRows.filter((row) => bangkokDateString(new Date(row.created_at)) === today).length,
    selectedUserClicks: history.length,
    averageClicksPerUser: people.length > 0 ? normalizedRows.length / people.length : 0,
  };

  return NextResponse.json({
    source,
    meta: VIEW_MODE_ANALYTICS_CONFIG[source],
    stats,
    people,
    history,
    selectedUser,
  });
}