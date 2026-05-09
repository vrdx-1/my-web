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
};

const VISITOR_PAGE_SIZE = 1000;
type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

async function fetchGroupedVisitorsByDate(
  admin: AdminClient,
  tableName: 'daily_user_visitors' | 'daily_guest_visitors',
  keyColumn: 'user_id' | 'guest_token',
  startDateIso: string,
  endDateIso: string
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

    const rows = (data || []) as Array<{ visit_date: string }>;
    for (const row of rows) {
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

  const today = getBangkokDateString();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(currentYear), 10);
  const year = Number.isFinite(yearParam) ? yearParam : currentYear;

  const startDateIso = `${year}-01-01`;
  const endDateIso = `${year}-12-31`;

  const [usersRes, guestsRes] = await Promise.all([
    fetchGroupedVisitorsByDate(admin, 'daily_user_visitors', 'user_id', startDateIso, endDateIso),
    fetchGroupedVisitorsByDate(admin, 'daily_guest_visitors', 'guest_token', startDateIso, endDateIso),
  ]);

  if (usersRes.error) {
    return internalServerError('admin/daily-visitors users query failed', usersRes.error);
  }
  if (guestsRes.error) {
    return internalServerError('admin/daily-visitors guests query failed', guestsRes.error);
  }

  const usersGrouped = usersRes.grouped ?? new Map<string, number>();
  const guestsGrouped = guestsRes.grouped ?? new Map<string, number>();

  // Build full-year rows
  const rows: DailyVisitorRow[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  for (let i = 0; i < daysInYear; i += 1) {
    const day = addDaysToDateString(startDateIso, i);
    if (day > endDateIso) break;
    const uniqueUsers = usersGrouped.get(day) ?? 0;
    const uniqueGuests = guestsGrouped.get(day) ?? 0;
    rows.push({
      visit_date: day,
      unique_users: uniqueUsers,
      unique_guests: uniqueGuests,
      unique_total: uniqueUsers + uniqueGuests,
    });
  }

  const todayUniqueUsers = usersGrouped.get(today) ?? 0;
  const todayUniqueGuests = guestsGrouped.get(today) ?? 0;
  const todayUniqueVisitors = todayUniqueUsers + todayUniqueGuests;
  const totalUniqueUsersInRange = rows.reduce((sum, row) => sum + row.unique_users, 0);
  const totalUniqueGuestsInRange = rows.reduce((sum, row) => sum + row.unique_guests, 0);
  const totalUniqueVisitorsInRange = rows.reduce((sum, row) => sum + row.unique_total, 0);

  return NextResponse.json({
    rows,
    summary: {
      year,
      totalUniqueUsersInRange,
      totalUniqueGuestsInRange,
      totalUniqueVisitorsInRange,
      todayUniqueUsers,
      todayUniqueGuests,
      todayUniqueVisitors,
      daysWithData: rows.filter((row) => row.unique_total > 0).length,
    },
  });
}
