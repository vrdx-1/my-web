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
 * POST /api/analytics/exchange-rate-popup-click
 * นับจำนวนครั้งที่กดดูปอบอับ "อัตราแลกเปลี่ยนโดยประมาณ"
 * ไม่นับการกดของ admin และ sub-account ของ admin
 */
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'analytics:exchange-rate-popup-click',
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
    data: { user },
  } = await supabase.auth.getUser();

  const userId: string | null = user?.id ?? null;

  // ไม่นับการกดของ admin และ sub-account ของ admin
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_sub_account')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'admin' || profile?.is_sub_account === true) {
      return NextResponse.json({ ok: true, skipped: 'admin' });
    }
  }

  const { error } = await admin.from('exchange_rate_popup_clicks').insert({});

  if (error) {
    return internalServerError('analytics/exchange-rate-popup-click insert failed', error);
  }

  return NextResponse.json({ ok: true });
}
