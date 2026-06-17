import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

type DailyRow = {
  clickDate: string;
  totalClicks: number;
};

type WhatsAppLogRow = {
  id: number;
  created_at: string;
  clicked_at: string | null;
  target_profile_id: string;
  user_id: string | null;
  guest_token: string | null;
  post_id: string | null;
  short_id: string | null;
  clicker_kind: 'guest' | 'user' | 'admin' | 'admin_sub_account' | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type PersonDetail = {
  personKey: string;
  personType: 'user' | 'guest';
  userId: string | null;
  guestToken: string | null;
  displayName: string;
  avatarUrl: string | null;
  totalClicks: number;
  firstClickAt: string;
  lastClickAt: string;
  posts: Array<{
    postId: string | null;
    shortId: string;
    clickCount: number;
  }>;
};

type AccountRow = {
  targetProfileId: string;
  username: string;
  avatarUrl: string | null;
  isSubAccount: boolean;
  parentAdminId: string | null;
  parentAdminUsername: string | null;
  totalClicks: number;
  userClicks: number;
  guestClicks: number;
  uniquePeople: number;
  uniqueUsers: number;
  uniqueGuests: number;
  topPosts: Array<{
    postId: string | null;
    shortId: string;
    clickCount: number;
    uniquePeople: number;
    userClicks: number;
    guestClicks: number;
    caption: string | null;
  }>;
  people: PersonDetail[];
};

type CarRow = {
  id: string;
  short_id: string | null;
  caption: string | null;
};

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }

  return { ok: true };
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

  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizePostKey(postId: string | null, shortId: string): string {
  return postId ? `id:${postId}` : `short:${shortId}`;
}

function normalizeGuestToken(token: string | null | undefined): string | null {
  const value = token?.trim();
  return value ? value : null;
}

function buildPersonKey(userId: string | null, guestToken: string | null, logId: number): string {
  if (userId) return `u:${userId}`;
  if (guestToken) return `g:${guestToken}`;
  return `log:${logId}`;
}

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
    .select('id, created_at, clicked_at, target_profile_id, user_id, guest_token, post_id, short_id, clicker_kind')
    .gte('created_at', startIso)
    .lt('created_at', nextIso)
    .order('created_at', { ascending: true });

  if (error) {
    return internalServerError('admin/whatsapp-clicks-insights query failed', error);
  }

  const monthLogs = ((data || []) as WhatsAppLogRow[]).filter(
    (row) => row.clicker_kind !== 'admin' && row.clicker_kind !== 'admin_sub_account'
  );

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
    dailyRows.push({ clickDate: day, totalClicks: dailyMap.get(day) ?? 0 });
  }

  const selectedDateLogs = monthLogs.filter(
    (row) => getBangkokDateString(new Date(row.created_at)) === selectedDate
  );

  const selectedUniquePeopleSet = new Set<string>();
  const selectedUniqueUserSet = new Set<string>();
  const selectedUniqueGuestSet = new Set<string>();

  const accountStats = new Map<string, {
    totalClicks: number;
    userClicks: number;
    guestClicks: number;
    uniquePeopleSet: Set<string>;
    uniqueUsers: Set<string>;
    uniqueGuests: Set<string>;
    postMap: Map<string, {
      postId: string | null;
      shortId: string;
      clickCount: number;
      userClicks: number;
      guestClicks: number;
      uniquePeopleSet: Set<string>;
    }>;
    personMap: Map<string, {
      personType: 'user' | 'guest';
      userId: string | null;
      guestToken: string | null;
      totalClicks: number;
      firstClickAt: string;
      lastClickAt: string;
      postMap: Map<string, { postId: string | null; shortId: string; clickCount: number }>;
    }>;
  }>();

  const globalPostMap = new Map<string, {
    postId: string | null;
    shortId: string;
    clickCount: number;
    userClicks: number;
    guestClicks: number;
    uniquePeopleSet: Set<string>;
    ownerProfileIds: Set<string>;
  }>();

  for (const row of selectedDateLogs) {
    const targetProfileId = row.target_profile_id;
    const postId = row.post_id?.trim() || null;
    const shortId = row.short_id?.trim() || 'unknown';
    const postKey = normalizePostKey(postId, shortId);
    const guestToken = normalizeGuestToken(row.guest_token);
    const personType: 'user' | 'guest' = row.user_id ? 'user' : 'guest';
    const personKey = buildPersonKey(row.user_id, guestToken, row.id);
    const clickedAt = row.clicked_at || row.created_at;

    selectedUniquePeopleSet.add(personKey);
    if (row.user_id) selectedUniqueUserSet.add(row.user_id);
    else if (guestToken) selectedUniqueGuestSet.add(guestToken);
    else selectedUniqueGuestSet.add(`log:${row.id}`);

    if (!accountStats.has(targetProfileId)) {
      accountStats.set(targetProfileId, {
        totalClicks: 0,
        userClicks: 0,
        guestClicks: 0,
        uniquePeopleSet: new Set<string>(),
        uniqueUsers: new Set<string>(),
        uniqueGuests: new Set<string>(),
        postMap: new Map(),
        personMap: new Map(),
      });
    }

    const account = accountStats.get(targetProfileId)!;
    account.totalClicks += 1;
    account.uniquePeopleSet.add(personKey);

    if (row.user_id) {
      account.userClicks += 1;
      account.uniqueUsers.add(row.user_id);
    } else {
      account.guestClicks += 1;
      account.uniqueGuests.add(guestToken || `log:${row.id}`);
    }

    if (!account.postMap.has(postKey)) {
      account.postMap.set(postKey, {
        postId,
        shortId,
        clickCount: 0,
        userClicks: 0,
        guestClicks: 0,
        uniquePeopleSet: new Set<string>(),
      });
    }
    const accountPost = account.postMap.get(postKey)!;
    accountPost.clickCount += 1;
    accountPost.uniquePeopleSet.add(personKey);
    if (row.user_id) accountPost.userClicks += 1;
    else accountPost.guestClicks += 1;

    if (!account.personMap.has(personKey)) {
      account.personMap.set(personKey, {
        personType,
        userId: row.user_id,
        guestToken,
        totalClicks: 0,
        firstClickAt: clickedAt,
        lastClickAt: clickedAt,
        postMap: new Map(),
      });
    }

    const person = account.personMap.get(personKey)!;
    person.totalClicks += 1;
    if (clickedAt < person.firstClickAt) person.firstClickAt = clickedAt;
    if (clickedAt > person.lastClickAt) person.lastClickAt = clickedAt;

    if (!person.postMap.has(postKey)) {
      person.postMap.set(postKey, { postId, shortId, clickCount: 0 });
    }
    const personPost = person.postMap.get(postKey)!;
    personPost.clickCount += 1;

    if (!globalPostMap.has(postKey)) {
      globalPostMap.set(postKey, {
        postId,
        shortId,
        clickCount: 0,
        userClicks: 0,
        guestClicks: 0,
        uniquePeopleSet: new Set<string>(),
        ownerProfileIds: new Set<string>(),
      });
    }
    const globalPost = globalPostMap.get(postKey)!;
    globalPost.clickCount += 1;
    globalPost.uniquePeopleSet.add(personKey);
    globalPost.ownerProfileIds.add(targetProfileId);
    if (row.user_id) globalPost.userClicks += 1;
    else globalPost.guestClicks += 1;
  }

  const targetProfileIds = Array.from(accountStats.keys());
  const { data: targetProfiles } = targetProfileIds.length
    ? await admin
        .from('profiles')
        .select('id, username, avatar_url, is_sub_account, parent_admin_id')
        .in('id', targetProfileIds)
    : { data: [] as ProfileRow[] };

  const profileMap = new Map<string, ProfileRow>();
  for (const row of targetProfiles || []) {
    profileMap.set(row.id, row);
  }

  const parentAdminIds = Array.from(
    new Set((targetProfiles || []).map((row) => row.parent_admin_id).filter(Boolean))
  ) as string[];
  const { data: parentProfiles } = parentAdminIds.length
    ? await admin.from('profiles').select('id, username').in('id', parentAdminIds)
    : { data: [] as Array<{ id: string; username: string | null }> };

  const parentUsernameMap = new Map<string, string>();
  for (const row of parentProfiles || []) {
    parentUsernameMap.set(row.id, row.username || 'Unknown');
  }

  const clickerUserIds = new Set<string>();
  for (const account of accountStats.values()) {
    for (const person of account.personMap.values()) {
      if (person.userId) clickerUserIds.add(person.userId);
    }
  }

  const clickerProfileMap = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (clickerUserIds.size > 0) {
    const { data: clickerProfiles } = await admin
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', Array.from(clickerUserIds));

    for (const row of (clickerProfiles || []) as Array<{ id: string; username: string | null; avatar_url: string | null }>) {
      clickerProfileMap.set(row.id, { username: row.username, avatar_url: row.avatar_url });
    }
  }

  const neededPostIds = new Set<string>();
  const neededShortIds = new Set<string>();
  for (const post of globalPostMap.values()) {
    if (post.postId) neededPostIds.add(post.postId);
    if (post.shortId !== 'unknown') neededShortIds.add(post.shortId);
  }

  const carById = new Map<string, CarRow>();
  const carByShortId = new Map<string, CarRow>();

  if (neededPostIds.size > 0) {
    const { data: carsByIdData } = await admin
      .from('cars')
      .select('id, short_id, caption')
      .in('id', Array.from(neededPostIds));

    for (const car of (carsByIdData || []) as CarRow[]) {
      carById.set(car.id, car);
      if (car.short_id) carByShortId.set(car.short_id, car);
    }
  }

  if (neededShortIds.size > 0) {
    const missingShortIds = Array.from(neededShortIds).filter((shortId) => !carByShortId.has(shortId));
    if (missingShortIds.length > 0) {
      const { data: carsByShortData } = await admin
        .from('cars')
        .select('id, short_id, caption')
        .in('short_id', missingShortIds);

      for (const car of (carsByShortData || []) as CarRow[]) {
        carById.set(car.id, car);
        if (car.short_id) carByShortId.set(car.short_id, car);
      }
    }
  }

  const accountRows: AccountRow[] = targetProfileIds
    .map((targetProfileId) => {
      const stats = accountStats.get(targetProfileId);
      if (!stats) return null;

      const profile = profileMap.get(targetProfileId);
      const parentAdminId = profile?.parent_admin_id || null;

      const topPosts = Array.from(stats.postMap.values())
        .map((post) => {
          const matchedCar = (post.postId ? carById.get(post.postId) : null)
            || (post.shortId !== 'unknown' ? carByShortId.get(post.shortId) : null)
            || null;
          return {
            postId: matchedCar?.id || post.postId,
            shortId: matchedCar?.short_id || post.shortId,
            clickCount: post.clickCount,
            uniquePeople: post.uniquePeopleSet.size,
            userClicks: post.userClicks,
            guestClicks: post.guestClicks,
            caption: matchedCar?.caption || null,
          };
        })
        .sort((a, b) => {
          if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
          return b.uniquePeople - a.uniquePeople;
        });

      const people: PersonDetail[] = Array.from(stats.personMap.entries())
        .map(([personKey, person]) => {
          const clickerProfile = person.userId ? clickerProfileMap.get(person.userId) : undefined;
          const displayName = person.personType === 'user'
            ? (clickerProfile?.username || 'Unknown user')
            : (person.guestToken || 'Guest (no token)');

          return {
            personKey,
            personType: person.personType,
            userId: person.userId,
            guestToken: person.guestToken,
            displayName,
            avatarUrl: person.personType === 'user' ? (clickerProfile?.avatar_url || null) : null,
            totalClicks: person.totalClicks,
            firstClickAt: person.firstClickAt,
            lastClickAt: person.lastClickAt,
            posts: Array.from(person.postMap.values())
              .sort((a, b) => b.clickCount - a.clickCount)
              .map((post) => ({
                postId: post.postId,
                shortId: post.shortId,
                clickCount: post.clickCount,
              })),
          };
        })
        .sort((a, b) => {
          if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
          return b.lastClickAt.localeCompare(a.lastClickAt);
        });

      return {
        targetProfileId,
        username: profile?.username || 'Unknown',
        avatarUrl: profile?.avatar_url || null,
        isSubAccount: Boolean(profile?.is_sub_account),
        parentAdminId,
        parentAdminUsername: parentAdminId ? parentUsernameMap.get(parentAdminId) || 'Unknown' : null,
        totalClicks: stats.totalClicks,
        userClicks: stats.userClicks,
        guestClicks: stats.guestClicks,
        uniquePeople: stats.uniquePeopleSet.size,
        uniqueUsers: stats.uniqueUsers.size,
        uniqueGuests: stats.uniqueGuests.size,
        topPosts,
        people,
      };
    })
    .filter((row): row is AccountRow => row !== null)
    .sort((a, b) => {
      if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
      if (b.uniquePeople !== a.uniquePeople) return b.uniquePeople - a.uniquePeople;
      return a.username.localeCompare(b.username, 'en');
    });

  const topPosts = Array.from(globalPostMap.values())
    .map((post) => {
      const matchedCar = (post.postId ? carById.get(post.postId) : null)
        || (post.shortId !== 'unknown' ? carByShortId.get(post.shortId) : null)
        || null;
      const owners = Array.from(post.ownerProfileIds)
        .map((id) => {
          const owner = profileMap.get(id);
          return {
            profileId: id,
            username: owner?.username || 'Unknown',
          };
        })
        .sort((a, b) => a.username.localeCompare(b.username, 'en'));

      return {
        postId: matchedCar?.id || post.postId,
        shortId: matchedCar?.short_id || post.shortId,
        caption: matchedCar?.caption || null,
        clickCount: post.clickCount,
        uniquePeople: post.uniquePeopleSet.size,
        userClicks: post.userClicks,
        guestClicks: post.guestClicks,
        ownerAccounts: owners,
      };
    })
    .sort((a, b) => {
      if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
      return b.uniquePeople - a.uniquePeople;
    })
    .slice(0, 15);

  const monthTotal = dailyRows.reduce((sum, row) => sum + row.totalClicks, 0);
  const selectedDateTotal = selectedDateLogs.length;
  const selectedDateUserClicks = selectedDateLogs.filter((row) => Boolean(row.user_id)).length;
  const selectedDateGuestClicks = selectedDateTotal - selectedDateUserClicks;
  const daysWithData = dailyRows.filter((row) => row.totalClicks > 0).length;

  const { startIso: todayStartIso, nextIso: todayNextIso } = getBangkokDayBoundaryUtcIso(today);
  const { count: todayCount } = await admin
    .from('whatsapp_click_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStartIso)
    .lt('created_at', todayNextIso)
    .or('clicker_kind.is.null,clicker_kind.eq.user,clicker_kind.eq.guest');

  return NextResponse.json({
    selectedDate,
    dailyRows,
    topPosts,
    accountRows,
    summary: {
      todayCount: todayCount ?? 0,
      monthTotal,
      selectedDateTotal,
      selectedDateUserClicks,
      selectedDateGuestClicks,
      selectedDateUniquePeople: selectedUniquePeopleSet.size,
      selectedDateUniqueUsers: selectedUniqueUserSet.size,
      selectedDateUniqueGuests: selectedUniqueGuestSet.size,
      daysWithData,
      accountsWithClicks: accountRows.length,
    },
  });
}
