import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

type DailyDownloadClickRow = {
  click_date: string;
  count: number;
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

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

const DOWNLOAD_CLICKS_PAGE_SIZE = 1000;
type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

async function fetchDownloadClickCreatedAtRows(
  admin: AdminClient,
  startIso: string,
  nextYearStartIso: string
) {
  const allRows: Array<{ created_at: string }> = [];
  let from = 0;

  for (;;) {
    const to = from + DOWNLOAD_CLICKS_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from('download_click_logs')
      .select('created_at')
      .gte('created_at', startIso)
      .lt('created_at', nextYearStartIso)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      return { rows: null, error };
    }

    const pageRows = (data || []) as Array<{ created_at: string }>;
    allRows.push(...pageRows);

    if (pageRows.length < DOWNLOAD_CLICKS_PAGE_SIZE) {
      break;
    }

    from += DOWNLOAD_CLICKS_PAGE_SIZE;
  }

  return { rows: allRows, error: null };
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

function getBangkokYearBoundaryUtcIso(year: number) {
  const bangkokOffsetMs = 7 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(year, 0, 1, 0, 0, 0) - bangkokOffsetMs;
  const nextYearStartUtcMs = Date.UTC(year + 1, 0, 1, 0, 0, 0) - bangkokOffsetMs;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    nextYearStartIso: new Date(nextYearStartUtcMs).toISOString(),
  };
}

/**
 * GET /api/admin/daily-download-clicks?year=2026
 * คืนข้อมูลจำนวนการกดปุ่มดาวน์โหลดรูปแบบรายวัน
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
  const minYear = 2025;
  const maxYear = currentYear + 9;
  const yearParam = parseInt(request.nextUrl.searchParams.get('year') || String(currentYear), 10);
  const normalizedYear = Number.isFinite(yearParam) ? yearParam : currentYear;
  const year = Math.max(minYear, Math.min(maxYear, normalizedYear));

  const { startIso, nextYearStartIso } = getBangkokYearBoundaryUtcIso(year);
  const queryRes = await fetchDownloadClickCreatedAtRows(admin, startIso, nextYearStartIso);

  if (queryRes.error) {
    return internalServerError('admin/daily-download-clicks query failed', queryRes.error);
  }

  const grouped = new Map<string, number>();
  for (const row of queryRes.rows || []) {
    const dateKey = getBangkokDateString(new Date(row.created_at));
    grouped.set(dateKey, (grouped.get(dateKey) ?? 0) + 1);
  }

  const rows: DailyDownloadClickRow[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  for (let i = 0; i < daysInYear; i += 1) {
    const day = addDaysToDateString(yearStart, i);
    if (day > yearEnd) break;
    rows.push({
      click_date: day,
      count: grouped.get(day) ?? 0,
    });
  }

  const totalInYear = rows.reduce((sum, row) => sum + row.count, 0);
  const daysWithData = rows.filter((row) => row.count > 0).length;
  const todayCount = grouped.get(today) ?? 0;

  return NextResponse.json({
    rows,
    summary: {
      year,
      todayCount,
      totalInYear,
      daysWithData,
    },
  });
}
