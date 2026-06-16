import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { tooManyRequests } from '@/lib/apiSecurity';

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
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

export type SidebarCounts = Record<string, number>;

const SIDEBAR_COUNTS_CACHE_TTL_MS = 10_000;
let sidebarCountsCache: { data: SidebarCounts; expiresAt: number } | null = null;

/**
 * GET: คืนจำนวนสำหรับแจ้งเตือนแต่ละแท็บใน admin sidebar
 */
export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:sidebar-counts',
    identifier: ip,
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
  }

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const now = Date.now();
  if (sidebarCountsCache && sidebarCountsCache.expiresAt > now) {
    return NextResponse.json(sidebarCountsCache.data, {
      headers: {
        'Cache-Control': 'private, max-age=5',
      },
    });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const counts: SidebarCounts = {};

  try {
    const [
      reportsTotal,
      problemReports,
      carsTotal,
      carEdits24h,
      postBoostsTotal,
      revenueLogs,
      downloadClickLogs,
      whatsappClickLogs,
      compareUsageLogs,
      verificationTotal,
      hiddenPosts,
      profilesTotal,
      searchLogsTotal,
      dailyUserVisitors,
      dailyGuestVisitors,
    ] = await Promise.all([
      admin.from('reports').select('*', { count: 'exact', head: true }),
      admin.from('user_problem_reports').select('*', { count: 'exact', head: true }),
      admin.from('cars').select('*', { count: 'exact', head: true }),
      admin.from('car_edits').select('*', { count: 'exact', head: true }).gte('edited_at', twentyFourHoursAgo),
      admin.from('post_boosts').select('*', { count: 'exact', head: true }),
      admin.from('revenue_logs').select('*', { count: 'exact', head: true }),
      admin.from('download_click_logs').select('*', { count: 'exact', head: true }),
      admin.from('whatsapp_click_logs').select('*', { count: 'exact', head: true }),
      admin.from('compare_usage_logs').select('*', { count: 'exact', head: true }),
      admin.from('verification_requests').select('*', { count: 'exact', head: true }),
      admin.from('cars').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      admin.from('profiles').select('*', { count: 'exact', head: true }),
      admin.from('search_logs').select('*', { count: 'exact', head: true }),
      admin.from('daily_user_visitors').select('*', { count: 'exact', head: true }),
      admin.from('daily_guest_visitors').select('*', { count: 'exact', head: true }),
    ]);

    counts['/admin/reporting'] = reportsTotal.count ?? 0;
    counts['/admin/problem-reports'] = problemReports.count ?? 0;
    counts['/admin/review'] = carsTotal.count ?? 0;
    counts['/admin/edited-posts'] = carEdits24h.count ?? 0;
    counts['/admin/boosting'] = postBoostsTotal.count ?? 0;
    counts['/admin/revenue'] = revenueLogs.count ?? 0;
    counts['/admin/download-clicks'] = downloadClickLogs.count ?? 0;
    counts['/admin/whatsapp-clicks'] = whatsappClickLogs.count ?? 0;
    counts['/admin/compare-usage'] = compareUsageLogs.count ?? 0;
    counts['/admin/verification'] = verificationTotal.count ?? 0;
    counts['/admin/hidden-posts'] = hiddenPosts.count ?? 0;
    counts['/admin/post'] = carsTotal.count ?? 0;
    counts['/admin/registrations'] = profilesTotal.count ?? 0;
    counts['/admin/top-user'] = profilesTotal.count ?? 0;
    counts['/admin/search-history'] = searchLogsTotal.count ?? 0;
    counts['/admin/visitor'] = (dailyUserVisitors.count ?? 0) + (dailyGuestVisitors.count ?? 0);
  } catch (e) {
    console.error('sidebar-counts error:', e);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }

  sidebarCountsCache = {
    data: counts,
    expiresAt: now + SIDEBAR_COUNTS_CACHE_TTL_MS,
  };

  return NextResponse.json(counts, {
    headers: {
      'Cache-Control': 'private, max-age=5',
    },
  });
}
