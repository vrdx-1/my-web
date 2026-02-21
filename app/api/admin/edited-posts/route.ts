import { NextRequest, NextResponse } from 'next/server';
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

/**
 * GET: รายการโพสที่ผู้ใช้แก้ไขภายใน 24 ชั่วโมง (สำหรับหน้า Admin Review Edited)
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

  const { data: editsData, error: editsError } = await admin
    .from('car_edits')
    .select('id, car_id, edited_at')
    .gte('edited_at', twentyFourHoursAgo)
    .order('edited_at', { ascending: false });

  if (editsError) {
    return NextResponse.json({ error: editsError.message }, { status: 500 });
  }
  if (!editsData || editsData.length === 0) {
    return NextResponse.json({ edits: [] });
  }

  const carIds = [...new Set(editsData.map((e) => e.car_id).filter(Boolean))];
  const { data: carsData, error: carsError } = await admin
    .from('cars')
    .select('id, caption, province, images, status, created_at, user_id, likes, views, saves, shares, is_hidden, profiles(username, avatar_url, last_seen)')
    .in('id', carIds);

  if (carsError) {
    return NextResponse.json({ error: carsError.message }, { status: 500 });
  }
  const carsMap = new Map((carsData ?? []).map((c) => [c.id, c]));

  const edits = editsData.map((e) => ({
    id: e.id,
    car_id: e.car_id,
    edited_at: e.edited_at,
    cars: carsMap.get(e.car_id) ?? null,
  }));

  return NextResponse.json({ edits });
}

/**
 * PATCH: Hide / Unhide โพส (บันทึกลงตาราง cars เหมือน reporting/reviews)
 */
export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  let body: { carId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const carId = body?.carId != null ? String(body.carId).trim() : '';
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (!carId || !['hide', 'unhide'].includes(action)) {
    return NextResponse.json({ error: 'carId and action: "hide" or "unhide" required' }, { status: 400 });
  }

  const isHidden = action === 'hide';
  const { error: carError } = await admin
    .from('cars')
    .update({ is_hidden: isHidden })
    .eq('id', carId);

  if (carError) {
    return NextResponse.json({ error: carError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
