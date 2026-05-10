import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

type DailyRow = {
  click_date: string;
  count: number;
};

type PostClickInfo = {
  postId: string | null;
  shortId: string;
  clickCount: number;
  post: Record<string, unknown> | null;
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
  posts: PostClickInfo[];
};

type WhatsAppLogRow = {
  id: number;
  created_at: string;
  target_profile_id: string;
  user_id: string | null;
  guest_token: string | null;
  post_id: string | null;
  short_id: string | null;
};

type CarLookupRow = {
  id: string;
  short_id: string | null;
  caption: string | null;
  price: number | string | null;
  price_currency: string | null;
  province: string | null;
  images: string[] | null;
  layout: string | null;
  status: string | null;
  created_at: string;
  user_id: string;
  likes: number | null;
  shares: number | null;
  is_hidden: boolean | null;
  is_boosted: boolean | null;
  profiles: {
    username: string | null;
    avatar_url: string | null;
    phone: string | null;
    is_verified: boolean | null;
  }[] | null;
};

type NormalizedCarLookupRow = Omit<CarLookupRow, 'profiles'> & {
  profiles: {
    username: string | null;
    avatar_url: string | null;
    phone: string | null;
    is_verified: boolean | null;
  } | null;
};

function normalizeCarRow(car: CarLookupRow): NormalizedCarLookupRow {
  const profile = Array.isArray(car.profiles) && car.profiles.length > 0 ? car.profiles[0] : null;
  return {
    ...car,
    profiles: profile
      ? {
          username: profile.username ?? null,
          avatar_url: profile.avatar_url ?? null,
          phone: profile.phone ?? null,
          is_verified: profile.is_verified ?? null,
        }
      : null,
  };
}

type ProfileLookupRow = {
  id: string;
  username: string | null;
  is_sub_account?: boolean | null;
  parent_admin_id?: string | null;
};

type ParentLookupRow = {
  id: string;
  username: string | null;
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
    .select('id, created_at, target_profile_id, user_id, guest_token, post_id, short_id')
    .gte('created_at', startIso)
    .lt('created_at', nextIso)
    .order('created_at', { ascending: true });

  if (error) {
    return internalServerError('admin/whatsapp-clicks query failed', error);
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
    postMap: Map<string, { postId: string | null; shortId: string; clickCount: number }>;
  }>();

  for (const row of selectedDateLogs) {
    const key = row.target_profile_id;
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        totalClicks: 0,
        userClicks: 0,
        guestClicks: 0,
        uniquePeopleSet: new Set<string>(),
        postMap: new Map(),
      });
    }

    const current = accountMap.get(key)!;
    current.totalClicks += 1;

    // Track post clicks by post_id first, fallback to short_id.
    const shortId = row.short_id?.trim() || 'unknown';
    const postId = row.post_id?.trim() || null;
    const postKey = postId ? `id:${postId}` : `short:${shortId}`;
    const existingPost = current.postMap.get(postKey);
    if (existingPost) {
      existingPost.clickCount += 1;
      if (!existingPost.shortId || existingPost.shortId === 'unknown') {
        existingPost.shortId = shortId;
      }
      if (!existingPost.postId && postId) {
        existingPost.postId = postId;
      }
    } else {
      current.postMap.set(postKey, {
        postId,
        shortId,
        clickCount: 1,
      });
    }

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
    : { data: [] as ProfileLookupRow[] };

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
    : { data: [] as ParentLookupRow[] };

  const parentNameMap = new Map<string, string>();
  for (const row of parentRows || []) {
    parentNameMap.set(row.id, row.username || 'Unknown');
  }

  const clickedPostIds = new Set<string>();
  const clickedShortIds = new Set<string>();
  for (const stats of accountMap.values()) {
    for (const postInfo of stats.postMap.values()) {
      if (postInfo.postId) clickedPostIds.add(postInfo.postId);
      if (postInfo.shortId && postInfo.shortId !== 'unknown') clickedShortIds.add(postInfo.shortId);
    }
  }

  const carsById = new Map<string, NormalizedCarLookupRow>();
  const carsByShortId = new Map<string, NormalizedCarLookupRow>();

  if (clickedPostIds.size > 0) {
    const { data: carRowsById } = await admin
      .from('cars')
      .select('id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles!cars_user_id_fkey(username, avatar_url, phone, is_verified)')
      .in('id', Array.from(clickedPostIds));

    for (const car of ((carRowsById || []) as unknown as CarLookupRow[])) {
      const normalizedCar = normalizeCarRow(car);
      carsById.set(normalizedCar.id, normalizedCar);
      if (normalizedCar.short_id) carsByShortId.set(normalizedCar.short_id, normalizedCar);
    }
  }

  if (clickedShortIds.size > 0) {
    const missingShortIds = Array.from(clickedShortIds).filter((shortId) => !carsByShortId.has(shortId));
    if (missingShortIds.length > 0) {
      const { data: carRowsByShortId } = await admin
        .from('cars')
        .select('id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles!cars_user_id_fkey(username, avatar_url, phone, is_verified)')
        .in('short_id', missingShortIds);

      for (const car of ((carRowsByShortId || []) as unknown as CarLookupRow[])) {
        const normalizedCar = normalizeCarRow(car);
        carsById.set(normalizedCar.id, normalizedCar);
        if (normalizedCar.short_id) carsByShortId.set(normalizedCar.short_id, normalizedCar);
      }
    }
  }

  const accountRows: AccountRow[] = targetProfileIds
    .map((profileId) => {
      const stats = accountMap.get(profileId);
      if (!stats) return null;

      const profile = profileMap.get(profileId);
      const parentAdminId = profile?.parent_admin_id ?? null;

      const posts: PostClickInfo[] = Array.from(stats.postMap.values())
        .map((postStats) => {
          const matchedPost = postStats.postId
            ? (carsById.get(postStats.postId) || null)
            : null;
          const fallbackPost = !matchedPost && postStats.shortId !== 'unknown'
            ? (carsByShortId.get(postStats.shortId) || null)
            : null;
          const post = matchedPost || fallbackPost;

          return {
            postId: post?.id || postStats.postId,
            shortId: post?.short_id || postStats.shortId,
            clickCount: postStats.clickCount,
            post,
          };
        })
        .sort((a, b) => b.clickCount - a.clickCount);

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
        posts,
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
