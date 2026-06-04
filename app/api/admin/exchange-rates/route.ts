import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { normalizeExchangeRates } from '@/utils/exchangeRates';

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
    return { ok: false, status: 401 as const, userId: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const, userId: null };
  }

  return { ok: true, status: 200 as const, userId: user.id };
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

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:exchange-rates:get',
    identifier: ip,
    limit: 120,
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

  const { data, error } = await admin
    .from('exchange_rates')
    .select('id, lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb, note, updated_by, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return internalServerError('admin/exchange-rates get failed', error);
  }

  const history = Array.isArray(data) ? data : [];
  const latest = history[0] || null;

  return NextResponse.json({
    latest: latest
      ? {
          ...latest,
          ...normalizeExchangeRates(latest),
        }
      : null,
    history,
  });
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:exchange-rates:post',
    identifier: ip,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  let body: {
    lak_to_thb?: number | string;
    lak_to_usd?: number | string;
    thb_to_lak?: number | string;
    thb_to_usd?: number | string;
    usd_to_lak?: number | string;
    usd_to_thb?: number | string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parseRate = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const lakToThb = parseRate(body?.lak_to_thb);
  const lakToUsd = parseRate(body?.lak_to_usd);
  const thbToLak = parseRate(body?.thb_to_lak);
  const thbToUsd = parseRate(body?.thb_to_usd);
  const usdToLak = parseRate(body?.usd_to_lak);
  const usdToThb = parseRate(body?.usd_to_thb);
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const { data: latest } = await admin
    .from('exchange_rates')
    .select('lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallback = normalizeExchangeRates(latest);

  const payload = {
    lak_to_thb: lakToThb ?? fallback.lak_to_thb,
    lak_to_usd: lakToUsd ?? fallback.lak_to_usd,
    thb_to_lak: thbToLak ?? fallback.thb_to_lak,
    thb_to_usd: thbToUsd ?? fallback.thb_to_usd,
    usd_to_lak: usdToLak ?? fallback.usd_to_lak,
    usd_to_thb: usdToThb ?? fallback.usd_to_thb,
  };

  const changedAny =
    lakToThb != null ||
    lakToUsd != null ||
    thbToLak != null ||
    thbToUsd != null ||
    usdToLak != null ||
    usdToThb != null;

  if (!changedAny) {
    return NextResponse.json({ error: 'At least one rate is required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('exchange_rates')
    .insert({
      ...payload,
      note: note || null,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb, note, updated_by, updated_at')
    .single();

  if (error) {
    return internalServerError('admin/exchange-rates post failed', error);
  }

  return NextResponse.json({
    ok: true,
    rate: {
      ...data,
      ...normalizeExchangeRates(data),
    },
    message: 'Exchange rate updated. Estimated post prices are being refreshed automatically.',
  });
}
