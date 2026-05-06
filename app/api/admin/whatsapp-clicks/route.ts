import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type DailyRow = {
  click_date: string;
  count: number;
};

type AccountRow = {
  targetProfileId: string;
  username: string;
  isSubAccount: boolean;
  parentAdminId: string | null;
  parentAdminUsername: string | null;
  totalClicks: number;
  uniquePeople: number;
  userClicks: number;
  guestClicks: number;
};

type WhatsAppLogRow = {
  id: number;
  created_at: string;
  target_profile_id: string;
  user_id: string | null;
  guest_token: string | null;
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

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getBangkokDayBoundaryUtcIso(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const bangkokOffsetMs = 7 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(year, (month || 1) - 1, day || 1, 0, 0, 0) - bangkokOffsetMs;
  const nextUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    nextIso: new Date(nextUtcMs).toISOString(),
  };
}

function getBangkokMonthBoundaryUtcIso(year: number, monthIndex: number) {
  const bangkokOffsetMs = 7 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(year, monthIndex, 1, 0, 0, 0) - bangkokOffsetMs;
  const nextUtcMs = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0) - bangkokOffsetMs;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    nextIso: new Date(nextUtcMs).toISOString(),
  };
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/admin/whatsapp-clicks?date=2026-05-07
 * คืนสถิติรายวัน + รายบัญชีของวันที่เลือก
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
  const rawDate = request.nextUrl.searchParams.get('date') || today;
  const selectedDate = isValidDateString(rawDate) ? rawDate : today;

  const selectedYear = Number(selectedDate.slice(0, 4));
  const selectedMonthIndex = Number(selectedDate.slice(5, 7)) - 1;
  const { startIso, nextIso } = getBangkokMonthBoundaryUtcIso(selectedYear, selectedMonthIndex);

  const { data, error } = await admin
    .from('whatsapp_click_logs')
    .select('id, created_at, target_profile_id, user_id, guest_token')
    .gte('created_at', startIso)
    .lt('created_at', nextIso)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const monthLogs = (data || []) as WhatsAppLogRow[];
  const dailyMap = new Map<string, number>();

  for (const row of monthLogs) {
    const day = getBangkokDateString(new Date(row.created_at));
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }

  const monthStartDate = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-01`;
  const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const dailyRows: DailyRow[] = [];

  for (let i = 0; i < daysInMonth; i += 1) {
    const day = addDaysToDateString(monthStartDate, i);
    dailyRows.push({
      click_date: day,
      count: dailyMap.get(day) ?? 0,
    });
  }

  const selectedDateLogs = monthLogs.filter(
    (row) => getBangkokDateString(new Date(row.created_at)) === selectedDate
  );

  const accountMap = new Map<string, {
    totalClicks: number;
    userClicks: number;
    guestClicks: number;
    uniquePeopleSet: Set<string>;
  }>();

  for (const row of selectedDateLogs) {
    const key = row.target_profile_id;
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        totalClicks: 0,
        userClicks: 0,
        guestClicks: 0,
        uniquePeopleSet: new Set<string>(),
      });
    }

    const current = accountMap.get(key)!;
    current.totalClicks += 1;

    if (row.user_id) {
      current.userClicks += 1;
      current.uniquePeopleSet.add(`u:${row.user_id}`);
    } else {
      current.guestClicks += 1;
      if (row.guest_token && row.guest_token.trim()) {
        current.uniquePeopleSet.add(`g:${row.guest_token.trim()}`);
      } else {
        current.uniquePeopleSet.add(`log:${row.id}`);
      }
    }
  }

  const targetProfileIds = Array.from(accountMap.keys());
  const { data: profileRows } = targetProfileIds.length
    ? await admin
        .from('profiles')
        .select('id, username, is_sub_account, parent_admin_id')
        .in('id', targetProfileIds)
    : { data: [] as any[] };

  const profileMap = new Map<string, { username: string | null; is_sub_account: boolean | null; parent_admin_id: string | null }>();
  for (const row of profileRows || []) {
    profileMap.set(row.id, {
      username: row.username ?? null,
      is_sub_account: row.is_sub_account ?? false,
      parent_admin_id: row.parent_admin_id ?? null,
    });
  }

  const parentIds = Array.from(
    new Set((profileRows || []).map((row) => row.parent_admin_id).filter(Boolean))
  ) as string[];

  const { data: parentRows } = parentIds.length
    ? await admin
        .from('profiles')
        .select('id, username')
        .in('id', parentIds)
    : { data: [] as any[] };

  const parentNameMap = new Map<string, string>();
  for (const row of parentRows || []) {
    parentNameMap.set(row.id, row.username || 'Unknown');
  }

  const accountRows: AccountRow[] = targetProfileIds
    .map((profileId) => {
      const stats = accountMap.get(profileId);
      if (!stats) return null;

      const profile = profileMap.get(profileId);
      const parentAdminId = profile?.parent_admin_id ?? null;

      return {
        targetProfileId: profileId,
        username: profile?.username || 'Unknown',
        isSubAccount: Boolean(profile?.is_sub_account),
        parentAdminId,
        parentAdminUsername: parentAdminId ? parentNameMap.get(parentAdminId) || 'Unknown' : null,
        totalClicks: stats.totalClicks,
        uniquePeople: stats.uniquePeopleSet.size,
        userClicks: stats.userClicks,
        guestClicks: stats.guestClicks,
      };
    })
    .filter((row): row is AccountRow => row !== null)
    .sort((a, b) => {
      if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
      if (b.uniquePeople !== a.uniquePeople) return b.uniquePeople - a.uniquePeople;
      return a.username.localeCompare(b.username, 'en');
    });

  const monthTotal = dailyRows.reduce((sum, row) => sum + row.count, 0);
  const selectedDateTotal = accountRows.reduce((sum, row) => sum + row.totalClicks, 0);
  const selectedDateUniquePeople = accountRows.reduce((sum, row) => sum + row.uniquePeople, 0);
  const daysWithData = dailyRows.filter((row) => row.count > 0).length;

  const { startIso: todayStartIso, nextIso: todayNextIso } = getBangkokDayBoundaryUtcIso(today);
  const { count: todayCount } = await admin
    .from('whatsapp_click_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStartIso)
    .lt('created_at', todayNextIso);

  return NextResponse.json({
    selectedDate,
    dailyRows,
    accountRows,
    summary: {
      todayCount: todayCount ?? 0,
      monthTotal,
      selectedDateTotal,
      selectedDateUniquePeople,
      daysWithData,
      accountsWithClicks: accountRows.length,
    },
  });
}
