import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * GET: ดึงรายการรายงานโพสต์ (reports) ทั้งหมด - เฉพาะ Admin
 * DELETE: ลบรายงาน (Ignore)
 * PATCH: Hide โพสต์ + ลบรายงาน
 * ใช้ SUPABASE_SERVICE_ROLE_KEY เพื่อ bypass RLS
 */
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

export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const { data: reportsData, error: reportsError } = await admin
    .from('reports')
    .select('id, car_id, reason, status, created_at, reporter_email, reporter_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (reportsError) {
    return NextResponse.json({ error: reportsError.message }, { status: 500 });
  }
  if (!reportsData || reportsData.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  const carIds = reportsData.map((r) => r.car_id).filter(Boolean);
  const { data: carsData, error: carsError } = await admin
    .from('cars')
    .select('id, caption, province, images, status, created_at, user_id, likes, views, saves, shares, profiles(username, avatar_url, last_seen)')
    .in('id', carIds);

  if (carsError) {
    return NextResponse.json({ error: carsError.message }, { status: 500 });
  }
  const carsMap = new Map((carsData ?? []).map((c) => [c.id, c]));

  const reporterIds = [...new Set((reportsData ?? []).map((r) => (r as { reporter_id?: string }).reporter_id).filter(Boolean))] as string[];
  let reporterProfilesMap = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (reporterIds.length > 0) {
    const { data: reporterProfiles } = await admin
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', reporterIds);
    reporterProfilesMap = new Map((reporterProfiles ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
  }

  const reports = reportsData.map((r) => {
    const row = r as { reporter_id?: string };
    return {
      ...r,
      cars: carsMap.get(r.car_id) ?? null,
      reporter_profile: row.reporter_id ? reporterProfilesMap.get(row.reporter_id) ?? null : null,
    };
  });

  return NextResponse.json({ reports });
}

export async function DELETE(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const { error } = await admin.from('reports').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  let body: { reportId?: string; carId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const reportId = body?.reportId != null ? String(body.reportId).trim() : '';
  const carId = body?.carId != null ? String(body.carId).trim() : '';
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (action !== 'hide' || !reportId || !carId) {
    return NextResponse.json({ error: 'reportId, carId and action: "hide" required' }, { status: 400 });
  }
  const { error: carError } = await admin
    .from('cars')
    .update({ is_hidden: true })
    .eq('id', carId);
  if (carError) {
    return NextResponse.json({ error: carError.message }, { status: 500 });
  }
  const { error: delError } = await admin.from('reports').delete().eq('id', reportId);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
