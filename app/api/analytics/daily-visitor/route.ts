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

function getBangkokDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * POST /api/analytics/daily-visitor
 * บันทึกผู้ใช้งานรายวันแบบ unique
 * - user: 1 user ต่อ 1 วันนับ 1 ครั้ง
 * - guest: 1 guest token ต่อ 1 วันนับ 1 ครั้ง
 * เงื่อนไข:
 * - ไม่นับ role = admin
 */
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'analytics:daily-visitor',
    identifier: ip,
    limit: 60,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = getBangkokDateString();
  const admin = getServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  if (user?.id) {
    const userId = user.id;
    const fallbackUsername =
      String(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          user.email ||
          'User'
      )
        .trim()
        .slice(0, 120) || 'User';

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    let profileId = profile?.id ?? null;
    let profileRole = profile?.role ?? null;

    // บัญชีที่ล็อกอินแล้วแต่ profile หลุดหาย ให้สร้างคืนก่อนนับรายวัน
    if (!profileId) {
      const { error: ensureProfileError } = await admin.from('profiles').upsert(
        {
          id: userId,
          username: fallbackUsername,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (ensureProfileError) {
        return internalServerError('analytics/daily-visitor ensure profile failed', {
          ensureProfileError,
          profileError,
        });
      }

      const { data: ensuredProfile, error: ensuredProfileError } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();

      if (ensuredProfileError || !ensuredProfile?.id) {
        return internalServerError('analytics/daily-visitor profile missing after ensure', {
          ensuredProfileError,
          ensuredProfile,
        });
      }

      profileId = ensuredProfile.id;
      profileRole = ensuredProfile.role ?? null;
    }

    if (profileRole === 'admin') {
      return NextResponse.json({ ok: true, skipped: 'admin' });
    }

    const { error } = await admin.from('daily_user_visitors').upsert(
      {
        visit_date: today,
        user_id: profileId,
      },
      {
        onConflict: 'visit_date,user_id',
        ignoreDuplicates: true,
      }
    );

    if (error) {
      return internalServerError('analytics/daily-visitor user upsert failed', error);
    }

    return NextResponse.json({ ok: true, tracked: 'user' });
  }

  const payload = await request.json().catch(() => ({}));
  const rawGuestToken = typeof payload?.guestToken === 'string' ? payload.guestToken : '';
  const guestToken = rawGuestToken.trim();

  if (!guestToken || guestToken.length > 200) {
    return NextResponse.json({ ok: true, skipped: 'no-guest-token' });
  }

  const { error } = await admin.from('daily_guest_visitors').upsert(
    {
      visit_date: today,
      guest_token: guestToken,
    },
    {
      onConflict: 'visit_date,guest_token',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    return internalServerError('analytics/daily-visitor guest upsert failed', error);
  }

  return NextResponse.json({ ok: true, tracked: 'guest' });
}
