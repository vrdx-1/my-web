import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';

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
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
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

/**
 * GET: รายการโพสต์ที่ถูกซ่อน (is_hidden = true) แยกตามสถานะ recommend/sold
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

  const statusRaw = request.nextUrl.searchParams.get('status');
  const status = statusRaw === 'sold' ? 'sold' : 'recommend';

  const { data, error } = await admin
    .from('cars')
    .select('id, caption, province, images, status, created_at, likes, shares, is_hidden, profiles(username, avatar_url)')
    .eq('is_hidden', true)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return internalServerError('admin/hidden-posts list failed', error);
  }

  return NextResponse.json({ posts: data ?? [] });
}

/**
 * PATCH: Hide / Unhide โพสต์
 */
export async function PATCH(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:hidden-posts:patch',
    identifier: ip,
    limit: 40,
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

  const { error } = await admin
    .from('cars')
    .update({ is_hidden: action === 'hide' })
    .eq('id', carId);

  if (error) {
    return internalServerError('admin/hidden-posts update failed', error);
  }

  return NextResponse.json({ ok: true });
}