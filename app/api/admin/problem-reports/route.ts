import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * GET: ดึงรายการรายงานปัญหาทั้งหมด (เฉพาะ Admin)
 * PATCH: อัปเดตสถานะรายงาน (เฉพาะ Admin)
 * ต้องมี SUPABASE_SERVICE_ROLE_KEY ใน .env.local
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

export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
  const { data: reports, error } = await admin
    .from('user_problem_reports')
    .select('id, user_id, message, image_urls, status, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!reports || reports.length === 0) {
    return NextResponse.json({ reports: [] });
  }
  const userIds = [...new Set(reports.map((r) => r.user_id))];
  const { data: profilesData } = await admin
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
  const profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const reportsWithProfile = reports.map((r) => ({
    ...r,
    profiles: profilesMap.get(r.user_id) ?? null,
  }));
  return NextResponse.json({ reports: reportsWithProfile });
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : '';
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  if (!['pending', 'resolved', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
  const { error: updateError } = await admin
    .from('user_problem_reports')
    .update({ status })
    .eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
  const { error: deleteError } = await admin
    .from('user_problem_reports')
    .delete()
    .eq('id', id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
