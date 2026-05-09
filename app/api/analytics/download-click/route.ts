import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

function getServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * POST /api/analytics/download-click
 * นับจำนวนครั้งที่ผู้ใช้กดปุ่มดาวน์โหลดรูป
 */
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'analytics:download-click',
    identifier: ip,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const payload = await request.json().catch(() => ({}));
  const sourceRaw = typeof payload?.source === 'string' ? payload.source : 'unknown';
  const source = sourceRaw.trim().slice(0, 80) || 'unknown';
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  const userId: string | null = session?.user?.id ?? null;

  // ไม่รวมการกดของแอดมินในสถิติ
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return NextResponse.json({ ok: true, skipped: 'admin' });
    }
  }

  const { error } = await admin.from('download_click_logs').insert({
    user_id: userId,
    source,
    user_agent: userAgent,
  });

  if (error) {
    return internalServerError('analytics/download-click insert failed', error);
  }

  return NextResponse.json({ ok: true });
}
