import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';

const ADMIN_SUB_ACCOUNT_CLEARS_TABLE = 'admin_sub_account_clears';

function isMissingClearsTableError(error: unknown): boolean {
  return String((error as { code?: string } | null)?.code || '') === '42P01';
}

function buildNotInFilter(ids: string[]): string {
  const escaped = ids
    .map((id) => String(id).replace(/"/g, '').replace(/,/g, '').trim())
    .filter(Boolean);
  return `(${escaped.join(',')})`;
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
    return { ok: false, status: 401 as const, adminId: null };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id, is_sub_account, parent_admin_id')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const, adminId: null };
  }
  const resolvedAdminId = profile?.is_sub_account ? (profile?.parent_admin_id || user.id) : user.id;
  return { ok: true, status: 200 as const, adminId: resolvedAdminId };
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
 * GET: ดึงโพสของ sub-account หนึ่งตัว โดยแยกตาม status (recommend/cleared)
 * ?subAccountId=xxx&status=recommend|cleared
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

  const subAccountId = request.nextUrl.searchParams.get('subAccountId');
  const statusParam = request.nextUrl.searchParams.get('status');
  const status = statusParam === 'cleared' ? 'cleared' : 'recommend';

  if (!subAccountId) {
    return NextResponse.json({ error: 'subAccountId required' }, { status: 400 });
  }

  // ตรวจสอบว่า sub-account นี้เป็นของ admin เจ้านี้หรือไม่
  const { data: subAccount } = await admin
    .from('profiles')
    .select('id, parent_admin_id, is_sub_account')
    .eq('id', subAccountId)
    .single();

  if (!subAccount || subAccount.parent_admin_id !== auth.adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (status === 'cleared') {
    const { data: clearedRows, error: clearedError } = await admin
      .from(ADMIN_SUB_ACCOUNT_CLEARS_TABLE)
      .select('car_id, cleared_at')
      .eq('admin_id', auth.adminId)
      .eq('sub_account_id', subAccountId)
      .order('cleared_at', { ascending: false });

    if (clearedError) {
      if (isMissingClearsTableError(clearedError)) {
        return NextResponse.json(
          { error: 'Database migration required: create admin_sub_account_clears table' },
          { status: 409 }
        );
      }
      return internalServerError('admin/sub-account-posts list cleared failed', clearedError);
    }

    const clearedCarIds = Array.from(new Set((clearedRows ?? []).map((row) => String(row.car_id || '').trim()).filter(Boolean)));
    if (clearedCarIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const { data: cars, error: carsError } = await admin
      .from('cars')
      .select(
        'id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles(username, avatar_url, phone, is_verified)'
      )
      .eq('user_id', subAccountId)
      .in('id', clearedCarIds);

    if (carsError) {
      return internalServerError('admin/sub-account-posts list cleared cars failed', carsError);
    }

    const carsMap = new Map((cars ?? []).map((car) => [String(car.id), car]));
    const orderedPosts = clearedCarIds
      .map((id) => carsMap.get(String(id)))
      .filter(Boolean);

    return NextResponse.json({ posts: orderedPosts });
  }

  const { data: clearedRows, error: clearedError } = await admin
    .from(ADMIN_SUB_ACCOUNT_CLEARS_TABLE)
    .select('car_id')
    .eq('admin_id', auth.adminId)
    .eq('sub_account_id', subAccountId);

  if (clearedError && !isMissingClearsTableError(clearedError)) {
    return internalServerError('admin/sub-account-posts list cleared ids failed', clearedError);
  }

  const clearedCarIds = Array.from(new Set((clearedRows ?? []).map((row) => String(row.car_id || '').trim()).filter(Boolean)));

  let postsQuery = admin
    .from('cars')
    .select(
      'id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles(username, avatar_url, phone, is_verified)'
    )
    .eq('user_id', subAccountId)
    .eq('status', 'recommend')
    .order('created_at', { ascending: false });

  if (clearedCarIds.length > 0) {
    postsQuery = postsQuery.not('id', 'in', buildNotInFilter(clearedCarIds));
  }

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    return internalServerError('admin/sub-account-posts list recommend failed', postsError);
  }

  return NextResponse.json({ posts: posts ?? [] });
}

/**
 * PATCH: อัปเดต caption หรือ price ของโพสหนึ่ง
 * { carId, caption?, price?, price_currency? }
 */
export async function PATCH(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:sub-account-posts:patch',
    identifier: ip,
    limit: 100,
    windowSeconds: 60,
  });
  if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

    const carId = typeof body?.carId === 'string' ? (body.carId as string).trim() : '';
  if (!carId) {
    return NextResponse.json({ error: 'carId required' }, { status: 400 });
  }

  // ตรวจสอบว่าโพสนี้เป็นของ sub-account ของ admin เจ้านี้หรือไม่
  const { data: car } = await admin
    .from('cars')
    .select('user_id, profiles!cars_user_id_fkey(parent_admin_id)')
    .eq('id', carId)
    .single();

  if (!car) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const profile = Array.isArray(car.profiles) ? car.profiles[0] : car.profiles;
  if (profile?.parent_admin_id !== auth.adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ประเมินข้อมูลที่ต้องอัปเดต
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (typeof body.caption === 'string') {
    updateData.caption = body.caption.trim();
  }

  if (body.price !== undefined) {
    if (body.price === null) {
      updateData.price = null;
    } else {
        const priceNum = Number(body.price as unknown as number);
      if (Number.isFinite(priceNum)) {
        updateData.price = Math.max(0, Math.trunc(priceNum));
      }
    }
  }

  if (typeof body.price_currency === 'string' && ['₭', '฿', '$'].includes(body.price_currency)) {
    updateData.price_currency = body.price_currency;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from('cars')
    .update(updateData)
    .eq('id', carId);

  if (updateError) {
    return internalServerError('admin/sub-account-posts update failed', updateError);
  }

  // บันทึกประวัติการแก้ไข
  const { error: editLogError } = await admin
    .from('car_edits')
    .insert({
      car_id: carId,
      edited_at: new Date().toISOString(),
    });

  if (editLogError) {
    console.warn('[admin/sub-account-posts] car_edits insert failed', editLogError);
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE: ทำเครื่องหมายโพสว่า "cleared" (แยกจาก sold)
 * { carId }
 */
export async function DELETE(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:sub-account-posts:delete',
    identifier: ip,
    limit: 50,
    windowSeconds: 60,
  });
  if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let body: { carId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const carId = typeof body?.carId === 'string' ? body.carId.trim() : '';
  if (!carId) {
    return NextResponse.json({ error: 'carId required' }, { status: 400 });
  }

  // ตรวจสอบ ownership
  const { data: car } = await admin
    .from('cars')
    .select('user_id, profiles!cars_user_id_fkey(parent_admin_id)')
    .eq('id', carId)
    .single();

  if (!car) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const profile = Array.isArray(car.profiles) ? car.profiles[0] : car.profiles;
  if (profile?.parent_admin_id !== auth.adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: clearError } = await admin
    .from(ADMIN_SUB_ACCOUNT_CLEARS_TABLE)
    .upsert(
      {
        admin_id: auth.adminId,
        sub_account_id: String(car.user_id),
        car_id: carId,
        cleared_at: new Date().toISOString(),
      },
      { onConflict: 'admin_id,car_id' }
    );

  if (clearError) {
    if (isMissingClearsTableError(clearError)) {
      return NextResponse.json(
        { error: 'Database migration required: create admin_sub_account_clears table' },
        { status: 409 }
      );
    }
    return internalServerError('admin/sub-account-posts clear failed', clearError);
  }

  return NextResponse.json({ ok: true });
}
