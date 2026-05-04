import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type DailyRegistrationRow = {
  register_date: string;
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return { ok: false, status: 401 as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
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
 * GET /api/admin/daily-registrations?year=2026
 * คืนข้อมูลจำนวนลงทะเบียนรายวันของปีที่เลือก
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

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const grouped = new Map<string, number>();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = data?.users ?? [];
    for (const user of users) {
      if (!user.created_at) continue;
      const registerDate = getBangkokDateString(new Date(user.created_at));
      if (registerDate < startDate || registerDate > endDate) continue;
      grouped.set(registerDate, (grouped.get(registerDate) ?? 0) + 1);
    }

    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  const rows: DailyRegistrationRow[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const yearStart = startDate;
  const yearEnd = endDate;

  for (let i = 0; i < daysInYear; i += 1) {
    const day = addDaysToDateString(yearStart, i);
    if (day > yearEnd) break;
    rows.push({
      register_date: day,
      count: grouped.get(day) ?? 0,
    });
  }

  const todayCount = grouped.get(today) ?? 0;
  const totalInYear = rows.reduce((sum, row) => sum + row.count, 0);
  const daysWithData = rows.filter((row) => row.count > 0).length;

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
