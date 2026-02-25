import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
  const { data: { session } } = await supabase.auth.getSession();
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
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

export type SidebarCounts = Record<string, number>;

/**
 * GET: คืนจำนวนสำหรับแจ้งเตือนแต่ละแท็บใน admin sidebar
 */
export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const counts: SidebarCounts = {};

  try {
    const [
      reportsPending,
      problemReports,
      carsTotal,
      carEdits24h,
      postBoostsPending,
      revenueLogs,
    ] = await Promise.all([
      admin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('user_problem_reports').select('*', { count: 'exact', head: true }),
      admin.from('cars').select('*', { count: 'exact', head: true }),
      admin.from('car_edits').select('*', { count: 'exact', head: true }).gte('edited_at', twentyFourHoursAgo),
      admin.from('post_boosts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('revenue_logs').select('*', { count: 'exact', head: true }),
    ]);

    counts['/admin/reporting'] = reportsPending.count ?? 0;
    counts['/admin/problem-reports'] = problemReports.count ?? 0;
    counts['/admin/review'] = carsTotal.count ?? 0;
    counts['/admin/edited-posts'] = carEdits24h.count ?? 0;
    counts['/admin/boosting'] = postBoostsPending.count ?? 0;
    counts['/admin/revenue'] = revenueLogs.count ?? 0;
  } catch (e) {
    console.error('sidebar-counts error:', e);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }

  return NextResponse.json(counts);
}
