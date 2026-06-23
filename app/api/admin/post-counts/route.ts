import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type AccountType = 'admin' | 'admin_sub_account' | 'user';

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  name: string | null;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type AccountStatRow = {
  account_id: string;
  account_type: AccountType;
  total_posts_all_time: number;
  last_counted_at: string | null;
  updated_at: string;
};

type AdminSubStatRow = {
  admin_id: string;
  total_sub_posts_all_time: number;
  last_counted_at: string | null;
  updated_at: string;
};

type GlobalStatRow = {
  total_posts_all_time: number;
  total_admin_posts_all_time: number;
  total_admin_sub_posts_all_time: number;
  total_user_posts_all_time: number;
  updated_at: string;
};

function apiError(stage: string, err: unknown) {
  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  return NextResponse.json(
    {
      error: `Post counts API failed at ${stage}`,
      stage,
      message: anyErr?.message || 'Unknown error',
      code: anyErr?.code || null,
      details: anyErr?.details || null,
      hint: anyErr?.hint || null,
    },
    { status: 500 },
  );
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

function profileLabel(profile: ProfileRow | null, accountId: string) {
  const fullName = (profile?.full_name || profile?.display_name || profile?.name || '').trim();
  const username = (profile?.username || '').trim();

  if (fullName && username) return `${fullName} (@${username})`;
  if (fullName) return fullName;
  if (username) return `@${username}`;
  return `Account ${accountId.slice(0, 8)}`;
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

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
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
    const requestedType = (searchParams.get('type') || 'all').trim();
    const accountTypeFilter: AccountType | 'all' =
      requestedType === 'admin' || requestedType === 'admin_sub_account' || requestedType === 'user'
        ? requestedType
        : 'all';
    const q = (searchParams.get('q') || '').trim();
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
    const pageSizeRaw = Number.parseInt(searchParams.get('pageSize') || '20', 10);
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(100, Math.max(5, pageSizeRaw)) : 20;
    const topLimitRaw = Number.parseInt(searchParams.get('topLimit') || '10', 10);
    const topLimit = Number.isFinite(topLimitRaw) ? Math.min(30, Math.max(3, topLimitRaw)) : 10;

    const [
      { data: globalRaw, error: globalError },
      { count: adminAccountsCount, error: adminCountError },
      { count: subAccountsCount, error: subCountError },
      { count: userAccountsCount, error: userCountError },
      { data: topAdminRaw, error: topAdminError },
      { data: topSubRaw, error: topSubError },
      { data: topUserRaw, error: topUserError },
      { data: adminOwnRaw, error: adminOwnError },
      { data: adminSubRaw, error: adminSubError },
    ] = await Promise.all([
      admin
        .from('global_post_stats')
        .select('total_posts_all_time, total_admin_posts_all_time, total_admin_sub_posts_all_time, total_user_posts_all_time, updated_at')
        .eq('singleton_id', true)
        .maybeSingle(),
      admin.from('account_post_stats').select('*', { count: 'exact', head: true }).eq('account_type', 'admin'),
      admin.from('account_post_stats').select('*', { count: 'exact', head: true }).eq('account_type', 'admin_sub_account'),
      admin.from('account_post_stats').select('*', { count: 'exact', head: true }).eq('account_type', 'user'),
      admin
        .from('account_post_stats')
        .select('account_id, account_type, total_posts_all_time, last_counted_at, updated_at')
        .eq('account_type', 'admin')
        .order('total_posts_all_time', { ascending: false })
        .limit(topLimit),
      admin
        .from('account_post_stats')
        .select('account_id, account_type, total_posts_all_time, last_counted_at, updated_at')
        .eq('account_type', 'admin_sub_account')
        .order('total_posts_all_time', { ascending: false })
        .limit(topLimit),
      admin
        .from('account_post_stats')
        .select('account_id, account_type, total_posts_all_time, last_counted_at, updated_at')
        .eq('account_type', 'user')
        .order('total_posts_all_time', { ascending: false })
        .limit(topLimit),
      admin
        .from('account_post_stats')
        .select('account_id, total_posts_all_time')
        .eq('account_type', 'admin')
        .order('total_posts_all_time', { ascending: false })
        .limit(2000),
      admin
        .from('admin_sub_account_post_stats')
        .select('admin_id, total_sub_posts_all_time, last_counted_at, updated_at')
        .order('total_sub_posts_all_time', { ascending: false })
        .limit(2000),
    ]);

    if (globalError) return apiError('global_stats_query', globalError);
    if (adminCountError) return apiError('admin_account_count', adminCountError);
    if (subCountError) return apiError('sub_account_count', subCountError);
    if (userCountError) return apiError('user_account_count', userCountError);
    if (topAdminError) return apiError('top_admin_query', topAdminError);
    if (topSubError) return apiError('top_sub_query', topSubError);
    if (topUserError) return apiError('top_user_query', topUserError);
    if (adminOwnError) return apiError('admin_own_query', adminOwnError);
    if (adminSubError) return apiError('admin_sub_query', adminSubError);

    const globalStats = (globalRaw as GlobalStatRow | null) || {
      total_posts_all_time: 0,
      total_admin_posts_all_time: 0,
      total_admin_sub_posts_all_time: 0,
      total_user_posts_all_time: 0,
      updated_at: new Date(0).toISOString(),
    };

    const topAdmins = (topAdminRaw as AccountStatRow[] | null) || [];
    const topSubAccounts = (topSubRaw as AccountStatRow[] | null) || [];
    const topUsers = (topUserRaw as AccountStatRow[] | null) || [];
    const adminOwnRows = (adminOwnRaw as Array<{ account_id: string; total_posts_all_time: number }> | null) || [];
    const adminSubRows = (adminSubRaw as AdminSubStatRow[] | null) || [];

    let filteredIds: string[] | null = null;
    if (q) {
      const ids = new Set<string>();
      const maybeId = q.trim();
      if (maybeId.length > 6) ids.add(maybeId);

      const [
        { data: byUsername, error: byUsernameError },
        { data: byFullName, error: byFullNameError },
        { data: byDisplayName, error: byDisplayNameError },
      ] = await Promise.all([
        admin.from('profiles').select('id').ilike('username', `%${q}%`).limit(200),
        admin.from('profiles').select('id').ilike('full_name', `%${q}%`).limit(200),
        admin.from('profiles').select('id').ilike('display_name', `%${q}%`).limit(200),
      ]);

      if (byUsernameError) return apiError('search_profiles_username', byUsernameError);
      if (byFullNameError) return apiError('search_profiles_full_name', byFullNameError);
      if (byDisplayNameError) return apiError('search_profiles_display_name', byDisplayNameError);

      ((byUsername as Array<{ id: string }> | null) || []).forEach((row) => ids.add(row.id));
      ((byFullName as Array<{ id: string }> | null) || []).forEach((row) => ids.add(row.id));
      ((byDisplayName as Array<{ id: string }> | null) || []).forEach((row) => ids.add(row.id));

      filteredIds = Array.from(ids);
    }

    let accountQuery = admin
      .from('account_post_stats')
      .select('account_id, account_type, total_posts_all_time, last_counted_at, updated_at', { count: 'exact' });

    if (accountTypeFilter !== 'all') {
      accountQuery = accountQuery.eq('account_type', accountTypeFilter);
    }

    if (filteredIds !== null) {
      if (filteredIds.length === 0) {
        return NextResponse.json({
          global: {
            totalPostsAllTime: Number(globalStats.total_posts_all_time || 0),
            totalAdminPostsAllTime: Number(globalStats.total_admin_posts_all_time || 0),
            totalSubAccountPostsAllTime: Number(globalStats.total_admin_sub_posts_all_time || 0),
            totalUserPostsAllTime: Number(globalStats.total_user_posts_all_time || 0),
            updatedAt: globalStats.updated_at,
          },
          accountTypeTotals: {
            adminAccounts: Number(adminAccountsCount || 0),
            subAccounts: Number(subAccountsCount || 0),
            userAccounts: Number(userAccountsCount || 0),
          },
          top: {
            admins: [],
            subAccounts: [],
            users: [],
            adminRollups: [],
          },
          accounts: {
            page,
            pageSize,
            totalRows: 0,
            rows: [],
          },
        });
      }

      accountQuery = accountQuery.in('account_id', filteredIds);
    }

    const { data: accountRowsRaw, error: accountRowsError, count: accountRowsCount } = await accountQuery
      .order('total_posts_all_time', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (accountRowsError) return apiError('account_rows_query', accountRowsError);

    const accountRows = (accountRowsRaw as AccountStatRow[] | null) || [];

    const idsToHydrate = new Set<string>();
    topAdmins.forEach((row) => idsToHydrate.add(row.account_id));
    topSubAccounts.forEach((row) => idsToHydrate.add(row.account_id));
    topUsers.forEach((row) => idsToHydrate.add(row.account_id));
    accountRows.forEach((row) => idsToHydrate.add(row.account_id));
    adminOwnRows.forEach((row) => idsToHydrate.add(row.account_id));
    adminSubRows.forEach((row) => idsToHydrate.add(row.admin_id));

    const profileRows: ProfileRow[] = [];
    const idList = Array.from(idsToHydrate);
    for (let i = 0; i < idList.length; i += 200) {
      const chunk = idList.slice(i, i + 200);
      const { data: rawProfiles, error: profilesError } = await admin
        .from('profiles')
        .select('*')
        .in('id', chunk);

      if (profilesError) return apiError('profiles_hydration', profilesError);

      const mapped = ((rawProfiles as Record<string, unknown>[] | null) || [])
        .map((row) => {
          const id = toStringOrNull(row.id);
          if (!id) return null;

          return {
            id,
            username: toStringOrNull(row.username) || toStringOrNull(row.user_name),
            full_name: toStringOrNull(row.full_name),
            display_name: toStringOrNull(row.display_name),
            name: toStringOrNull(row.name),
            role: toStringOrNull(row.role),
            is_sub_account: toBooleanOrNull(row.is_sub_account),
            parent_admin_id: toStringOrNull(row.parent_admin_id),
          } as ProfileRow;
        })
        .filter((row): row is ProfileRow => Boolean(row));

      profileRows.push(...mapped);
    }

    const profileMap = new Map<string, ProfileRow>();
    profileRows.forEach((profile) => profileMap.set(profile.id, profile));

    const mapAccountRow = (row: AccountStatRow) => {
      const profile = profileMap.get(row.account_id) || null;
      return {
        accountId: row.account_id,
        accountType: row.account_type,
        totalPostsAllTime: Number(row.total_posts_all_time || 0),
        lastCountedAt: row.last_counted_at,
        updatedAt: row.updated_at,
        profile: {
          label: profileLabel(profile, row.account_id),
          username: profile?.username || null,
          fullName: profile?.full_name || profile?.display_name || profile?.name || null,
          role: profile?.role || null,
          isSubAccount: profile?.is_sub_account || false,
          parentAdminId: profile?.parent_admin_id || null,
        },
      };
    };

    const adminRollupMap = new Map<string, {
      adminId: string;
      adminLabel: string;
      adminOwnPosts: number;
      subAccountPosts: number;
      combinedPosts: number;
      lastCountedAt: string | null;
    }>();

    adminOwnRows.forEach((row) => {
      const profile = profileMap.get(row.account_id) || null;
      adminRollupMap.set(row.account_id, {
        adminId: row.account_id,
        adminLabel: profileLabel(profile, row.account_id),
        adminOwnPosts: Number(row.total_posts_all_time || 0),
        subAccountPosts: 0,
        combinedPosts: Number(row.total_posts_all_time || 0),
        lastCountedAt: null,
      });
    });

    adminSubRows.forEach((row) => {
      const existing = adminRollupMap.get(row.admin_id);
      const profile = profileMap.get(row.admin_id) || null;
      const subPosts = Number(row.total_sub_posts_all_time || 0);

      if (!existing) {
        adminRollupMap.set(row.admin_id, {
          adminId: row.admin_id,
          adminLabel: profileLabel(profile, row.admin_id),
          adminOwnPosts: 0,
          subAccountPosts: subPosts,
          combinedPosts: subPosts,
          lastCountedAt: row.last_counted_at,
        });
        return;
      }

      existing.subAccountPosts = subPosts;
      existing.combinedPosts = existing.adminOwnPosts + subPosts;
      existing.lastCountedAt = row.last_counted_at;
    });

    const sortByPosts = <T extends { totalPostsAllTime: number }>(rows: T[]) =>
      [...rows].sort((a, b) => b.totalPostsAllTime - a.totalPostsAllTime);

    return NextResponse.json({
      global: {
        totalPostsAllTime: Number(globalStats.total_posts_all_time || 0),
        totalAdminPostsAllTime: Number(globalStats.total_admin_posts_all_time || 0),
        totalSubAccountPostsAllTime: Number(globalStats.total_admin_sub_posts_all_time || 0),
        totalUserPostsAllTime: Number(globalStats.total_user_posts_all_time || 0),
        updatedAt: globalStats.updated_at,
      },
      accountTypeTotals: {
        adminAccounts: Number(adminAccountsCount || 0),
        subAccounts: Number(subAccountsCount || 0),
        userAccounts: Number(userAccountsCount || 0),
      },
      top: {
        admins: sortByPosts(topAdmins.map(mapAccountRow)).slice(0, topLimit),
        subAccounts: sortByPosts(topSubAccounts.map(mapAccountRow)).slice(0, topLimit),
        users: sortByPosts(topUsers.map(mapAccountRow)).slice(0, topLimit),
        adminRollups: Array.from(adminRollupMap.values())
          .sort((a, b) => b.combinedPosts - a.combinedPosts)
          .slice(0, topLimit),
      },
      accounts: {
        page,
        pageSize,
        totalRows: Number(accountRowsCount || 0),
        rows: accountRows.map(mapAccountRow),
      },
      query: {
        accountType: accountTypeFilter,
        search: q,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError('unexpected', error);
  }
}
