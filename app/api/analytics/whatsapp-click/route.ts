import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * POST /api/analytics/whatsapp-click
 * นับทุกครั้งที่กดปุ่ม WhatsApp ใต้ PostCard
 * - นับทั้ง user และ guest
 * - ไม่นับ role = admin
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
  const localSignal = `${origin} ${referer} ${host}`.toLowerCase();

  if (localSignal.includes('localhost') || localSignal.includes('127.0.0.1')) {
    return NextResponse.json({ ok: true, skipped: 'localhost' });
  }

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

  const admin = getServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let userId: string | null = null;

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  if (cookieUser?.id) {
    userId = cookieUser.id;
  }

  if (!userId) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (accessToken) {
      const {
        data: { user: headerUser },
      } = await supabase.auth.getUser(accessToken);
      if (headerUser?.id) {
        userId = headerUser.id;
      }
    }
  }

  const payload = await request.json().catch(() => ({}));
  const sourceRaw = typeof payload?.source === 'string' ? payload.source : 'unknown';
  const source = sourceRaw.trim().slice(0, 80) || 'unknown';
  const targetProfileIdRaw = typeof payload?.targetProfileId === 'string' ? payload.targetProfileId : '';
  const postIdRaw = typeof payload?.postId === 'string' ? payload.postId : '';
  const guestTokenRaw = typeof payload?.guestToken === 'string' ? payload.guestToken : '';

  const targetProfileId = targetProfileIdRaw.trim();
  if (!targetProfileId) {
    return NextResponse.json({ ok: true, skipped: 'missing-target-profile' });
  }

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_sub_account, parent_admin_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return NextResponse.json({ ok: true, skipped: 'admin' });
    }

    if (profile?.is_sub_account === true && profile?.parent_admin_id) {
      return NextResponse.json({ ok: true, skipped: 'admin-sub-account' });
    }
  }

  const postId = postIdRaw.trim() || null;
  const guestToken = !userId ? guestTokenRaw.trim().slice(0, 200) || null : null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  // Get short_id from cars table if post_id exists
  let shortId: string | null = null;
  if (postId) {
    const { data: postData } = await admin
      .from('cars')
      .select('short_id')
      .eq('id', postId)
      .maybeSingle();
    
    shortId = postData?.short_id || null;
  }

  const { error } = await admin.from('whatsapp_click_logs').insert({
    user_id: userId,
    guest_token: guestToken,
    target_profile_id: targetProfileId,
    post_id: postId,
    short_id: shortId,
    source,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
