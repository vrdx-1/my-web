import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

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

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type DailyVisitorRow = {
  visit_date: string;
  unique_users: number;
  unique_guests: number;
  unique_total: number;
  visit_events_users: number;
  visit_events_guests: number;
  visit_events_total: number;
};

type VisitEventCounter = {
  users: number;
  guests: number;
  total: number;
};

type DailyVisitorDetailPerson = {
  actor_type: 'user' | 'guest';
  actor_key: string;
  user_id: string | null;
  guest_token: string | null;
  display_name: string;
  visit_count: number;
  first_visit_at: string;
  last_visit_at: string;
  visits: Array<{
    visited_at: string;
    entry_path: string;
  }>;
};

const VISITOR_PAGE_SIZE = 1000;
type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

async function fetchExcludedAdminUserIds(admin: AdminClient) {
  const excluded = new Set<string>();
  let from = 0;

  for (;;) {
    const to = from + VISITOR_PAGE_SIZE - 1;
    let data: Array<{ id: string }> | null = null;

    const withSubAccountRes = await admin
      .from('profiles')
      .select('id, role, is_sub_account')
      .or('role.eq.admin,is_sub_account.eq.true')
      .order('id', { ascending: true })
      .range(from, to);

    if (withSubAccountRes.error) {
      const fallbackRes = await admin
        .from('profiles')
        .select('id, role')
        .eq('role', 'admin')
        .order('id', { ascending: true })
        .range(from, to);

      if (fallbackRes.error) {
        return { excluded: null, error: fallbackRes.error };
      }

      data = (fallbackRes.data || []) as Array<{ id: string }>;
    } else {
      data = (withSubAccountRes.data || []) as Array<{ id: string }>;
    }

    const rows = data || [];
    for (const row of rows) {
      const id = String(row.id || '').trim();
      if (id) excluded.add(id);
    }

    if (rows.length < VISITOR_PAGE_SIZE) {
      break;
    }

    from += VISITOR_PAGE_SIZE;
  }

  return { excluded, error: null };
}

async function fetchGroupedVisitorsByDate(
  admin: AdminClient,
  tableName: 'daily_user_visitors' | 'daily_guest_visitors',
  keyColumn: 'user_id' | 'guest_token',
  startDateIso: string,
  endDateIso: string,
  excludedAdminUserIds: Set<string>
) {
  const grouped = new Map<string, number>();
  let from = 0;

  for (;;) {
    const to = from + VISITOR_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from(tableName)
      .select(`visit_date, ${keyColumn}`)
      .gte('visit_date', startDateIso)
      .lte('visit_date', endDateIso)
      .order('visit_date', { ascending: true })
      .order(keyColumn, { ascending: true })
      .range(from, to);

    if (error) {
      return { grouped: null, error };
    }

    const rows = (data || []) as Array<{ visit_date: string; user_id?: string | null }>;
    for (const row of rows) {
      if (
        tableName === 'daily_user_visitors' &&
        excludedAdminUserIds.has(String(row.user_id || ''))
      ) {
        continue;
      }
      const date = String(row.visit_date);
      grouped.set(date, (grouped.get(date) ?? 0) + 1);
    }

    if (rows.length < VISITOR_PAGE_SIZE) {
      break;
    }

    from += VISITOR_PAGE_SIZE;
  }

  return { grouped, error: null };
}

async function fetchVisitEventCountsByDate(
  admin: AdminClient,
  startDateIso: string,
  endDateIso: string,
  excludedAdminUserIds: Set<string>
) {
  const grouped = new Map<string, VisitEventCounter>();
  let from = 0;

  for (;;) {
    const to = from + VISITOR_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from('visitor_visit_logs')
      .select('visit_date, actor_type, user_id')
      .gte('visit_date', startDateIso)
      .lte('visit_date', endDateIso)
      .order('visit_date', { ascending: true })
      .order('visited_at', { ascending: true })
      .range(from, to);

    if (error) {
      return { grouped: null, error };
    }

    const rows = (data || []) as Array<{
      visit_date: string;
      actor_type: 'user' | 'guest';
      user_id: string | null;
    }>;
    for (const row of rows) {
      if (
        row.actor_type === 'user' &&
        excludedAdminUserIds.has(String(row.user_id || ''))
      ) {
        continue;
      }
      const date = String(row.visit_date);
      const current = grouped.get(date) ?? { users: 0, guests: 0, total: 0 };
      if (row.actor_type === 'user') {
        current.users += 1;
      } else {
        current.guests += 1;
      }
      current.total += 1;
      grouped.set(date, current);
    }

    if (rows.length < VISITOR_PAGE_SIZE) {
      break;
    }

    from += VISITOR_PAGE_SIZE;
  }

  return { grouped, error: null };
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatVisitorDisplayName(actorType: 'user' | 'guest', actorKey: string, username?: string | null): string {
  if (actorType === 'user') {
    const trimmedName = String(username ?? '').trim();
    if (trimmedName) return trimmedName;
    return `User ${actorKey.slice(0, 8)}`;
  }

  return `Guest ${actorKey.slice(-8)}`;
}

async function fetchProfilesMap(admin: AdminClient, userIds: string[]) {
  const profiles = new Map<string, string>();

  for (let index = 0; index < userIds.length; index += 200) {
    const chunk = userIds.slice(index, index + 200);
    if (chunk.length === 0) continue;

    const { data, error } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', chunk);

    if (error) {
      return { profiles: null, error };
    }

    for (const row of (data || []) as Array<{ id: string; username: string | null }>) {
      profiles.set(String(row.id), String(row.username ?? ''));
    }
  }

  return { profiles, error: null };
}

async function fetchVisitDetailsByDate(
  admin: AdminClient,
  dateIso: string,
  excludedAdminUserIds: Set<string>
) {
  const grouped = new Map<string, DailyVisitorDetailPerson>();
  const userIds = new Set<string>();
  let from = 0;

  for (;;) {
    const to = from + VISITOR_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from('visitor_visit_logs')
      .select('actor_type, actor_key, user_id, guest_token, entry_path, visited_at')
      .eq('visit_date', dateIso)
      .order('visited_at', { ascending: true })
      .range(from, to);

    if (error) {
      return { detail: null, error };
    }

    const rows = (data || []) as Array<{
      actor_type: 'user' | 'guest';
      actor_key: string;
      user_id: string | null;
      guest_token: string | null;
      entry_path: string | null;
      visited_at: string;
    }>;

    for (const row of rows) {
      const actorType = row.actor_type === 'user' ? 'user' : 'guest';
      if (
        actorType === 'user' &&
        excludedAdminUserIds.has(String(row.user_id || ''))
      ) {
        continue;
      }
      const actorKey = String(row.actor_key || '');
      if (!actorKey) continue;

      const groupKey = `${actorType}:${actorKey}`;
      const existing = grouped.get(groupKey) ?? {
        actor_type: actorType,
        actor_key: actorKey,
        user_id: row.user_id ? String(row.user_id) : null,
        guest_token: row.guest_token ? String(row.guest_token) : null,
        display_name: '',
        visit_count: 0,
        first_visit_at: String(row.visited_at),
        last_visit_at: String(row.visited_at),
        visits: [],
      };

      const visitedAt = String(row.visited_at);
      existing.visit_count += 1;
      existing.first_visit_at = existing.first_visit_at < visitedAt ? existing.first_visit_at : visitedAt;
      existing.last_visit_at = existing.last_visit_at > visitedAt ? existing.last_visit_at : visitedAt;
      existing.visits.push({
        visited_at: visitedAt,
        entry_path: String(row.entry_path || '/'),
      });
      grouped.set(groupKey, existing);

      if (existing.user_id) {
        userIds.add(existing.user_id);
      }
    }

    if (rows.length < VISITOR_PAGE_SIZE) {
      break;
    }

    from += VISITOR_PAGE_SIZE;
  }

  const userIdList = Array.from(userIds);
  const profilesRes = await fetchProfilesMap(admin, userIdList);
  if (profilesRes.error) {
    return { detail: null, error: profilesRes.error };
  }

  const people = Array.from(grouped.values())
    .map((person) => ({
      ...person,
      display_name: formatVisitorDisplayName(
        person.actor_type,
        person.actor_key,
        person.user_id ? profilesRes.profiles?.get(person.user_id) : null
      ),
    }))
    .sort((a, b) => {
      if (b.visit_count !== a.visit_count) return b.visit_count - a.visit_count;
      return b.last_visit_at.localeCompare(a.last_visit_at);
    });

  const uniqueUsers = people.filter((person) => person.actor_type === 'user').length;
  const uniqueGuests = people.filter((person) => person.actor_type === 'guest').length;
  const totalVisitEvents = people.reduce((sum, person) => sum + person.visit_count, 0);

  return {
    detail: {
      date: dateIso,
      uniqueUsers,
      uniqueGuests,
      uniqueVisitors: people.length,
      totalVisitEvents,
      people,
    },
    error: null,
  };
}

function getBangkokDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/admin/daily-visitors?year=2026
 * คืนข้อมูลรายวันตลอดปีที่เลือก (ทั้ง user และ guest)
 */
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'summary';
  const dateParam = String(request.nextUrl.searchParams.get('date') || '').trim();

  const excludedAdminUserIdsRes = await fetchExcludedAdminUserIds(admin);
  if (excludedAdminUserIdsRes.error) {
    return internalServerError('admin/daily-visitors excluded profiles query failed', excludedAdminUserIdsRes.error);
  }
  const excludedAdminUserIds = excludedAdminUserIdsRes.excluded ?? new Set<string>();

  if (mode === 'detail') {
    if (!isIsoDateString(dateParam)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const detailRes = await fetchVisitDetailsByDate(admin, dateParam, excludedAdminUserIds);
    if (detailRes.error) {
      return internalServerError('admin/daily-visitors detail query failed', detailRes.error);
    }

    return NextResponse.json({ detail: detailRes.detail });
  }

  const today = getBangkokDateString();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(currentYear), 10);
  const year = Number.isFinite(yearParam) ? yearParam : currentYear;

  const startDateIso = `${year}-01-01`;
  const endDateIso = `${year}-12-31`;

  const [usersRes, guestsRes, visitEventsRes] = await Promise.all([
    fetchGroupedVisitorsByDate(admin, 'daily_user_visitors', 'user_id', startDateIso, endDateIso, excludedAdminUserIds),
    fetchGroupedVisitorsByDate(admin, 'daily_guest_visitors', 'guest_token', startDateIso, endDateIso, excludedAdminUserIds),
    fetchVisitEventCountsByDate(admin, startDateIso, endDateIso, excludedAdminUserIds),
  ]);

  if (usersRes.error) {
    return internalServerError('admin/daily-visitors users query failed', usersRes.error);
  }
  if (guestsRes.error) {
    return internalServerError('admin/daily-visitors guests query failed', guestsRes.error);
  }
  if (visitEventsRes.error) {
    return internalServerError('admin/daily-visitors visit-events query failed', visitEventsRes.error);
  }

  const usersGrouped = usersRes.grouped ?? new Map<string, number>();
  const guestsGrouped = guestsRes.grouped ?? new Map<string, number>();
  const visitEventsGrouped = visitEventsRes.grouped ?? new Map<string, VisitEventCounter>();

  // Build full-year rows
  const rows: DailyVisitorRow[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  for (let i = 0; i < daysInYear; i += 1) {
    const day = addDaysToDateString(startDateIso, i);
    if (day > endDateIso) break;
    const uniqueUsers = usersGrouped.get(day) ?? 0;
    const uniqueGuests = guestsGrouped.get(day) ?? 0;
    const visitEvents = visitEventsGrouped.get(day) ?? { users: 0, guests: 0, total: 0 };
    rows.push({
      visit_date: day,
      unique_users: uniqueUsers,
      unique_guests: uniqueGuests,
      unique_total: uniqueUsers + uniqueGuests,
      visit_events_users: visitEvents.users,
      visit_events_guests: visitEvents.guests,
      visit_events_total: visitEvents.total,
    });
  }

  const todayUniqueUsers = usersGrouped.get(today) ?? 0;
  const todayUniqueGuests = guestsGrouped.get(today) ?? 0;
  const todayUniqueVisitors = todayUniqueUsers + todayUniqueGuests;
  const todayVisitEvents = visitEventsGrouped.get(today)?.total ?? 0;
  const totalUniqueUsersInRange = rows.reduce((sum, row) => sum + row.unique_users, 0);
  const totalUniqueGuestsInRange = rows.reduce((sum, row) => sum + row.unique_guests, 0);
  const totalUniqueVisitorsInRange = rows.reduce((sum, row) => sum + row.unique_total, 0);
  const totalVisitEventsInRange = rows.reduce((sum, row) => sum + row.visit_events_total, 0);

  return NextResponse.json({
    rows,
    summary: {
      year,
      totalUniqueUsersInRange,
      totalUniqueGuestsInRange,
      totalUniqueVisitorsInRange,
      totalVisitEventsInRange,
      todayUniqueUsers,
      todayUniqueGuests,
      todayUniqueVisitors,
      todayVisitEvents,
      daysWithData: rows.filter((row) => row.unique_total > 0).length,
    },
  });
}
