import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

type FilterActorRole = 'guest' | 'user';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-guest-token, x-active-profile-id',
};

/**
 * POST /api/filter/log
 * บันทึกการใช้ตัวกรอง (filter) ลง filter_search_logs
 * เฉพาะ Guest และ User ทั่วไปเท่านั้น — ข้าม admin / sub_admin
 *
 * Body: {
 *   province?: string,
 *   min_price_kip?: number | null,
 *   max_price_kip?: number | null,
 *   price_sort_order?: 'asc' | 'desc' | '',
 *   latest_post_first?: boolean,
 *   guest_token?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const province = typeof body.province === 'string' ? body.province.trim().slice(0, 100) : null;
    const min_price_kip = typeof body.min_price_kip === 'number' && Number.isFinite(body.min_price_kip)
      ? Math.max(0, Math.round(body.min_price_kip))
      : null;
    const max_price_kip = typeof body.max_price_kip === 'number' && Number.isFinite(body.max_price_kip)
      ? Math.max(0, Math.round(body.max_price_kip))
      : null;
    const price_sort_order_raw = body.price_sort_order;
    const price_sort_order = price_sort_order_raw === 'asc' || price_sort_order_raw === 'desc'
      ? price_sort_order_raw
      : null;
    const latest_post_first = body.latest_post_first === true || price_sort_order_raw === 'latest'
      ? true
      : null;
    const display_currency_raw = body.display_currency;
    const display_currency = display_currency_raw === '₭' || display_currency_raw === '$' || display_currency_raw === '฿'
      ? display_currency_raw as '₭' | '$' | '฿'
      : null;

    const guest_token_raw = typeof body.guest_token === 'string' ? body.guest_token.trim() : '';
    const guest_token = guest_token_raw ? guest_token_raw.slice(0, 200) : null;

    // ต้องมีตัวกรองอย่างน้อย 1 ตัว
    const hasFilter = (province && province.length > 0)
      || min_price_kip != null
      || max_price_kip != null
      || price_sort_order != null
      || latest_post_first === true;

    if (!hasFilter) {
      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    // Rate limit by IP
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'filter:log',
      identifier: ip,
      limit: 60,
      windowSeconds: 60,
    });
    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    // Resolve identity — ถ้า explicit guest ข้ามการ resolve cookie เพื่อป้องกัน stale-cookie bleed
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const hasExplicitBearerAuth = !!authHeader?.startsWith('Bearer ');
    const explicitGuestTokenHeader = (request.headers.get('x-guest-token') || '').trim();
    const isExplicitGuest = !hasExplicitBearerAuth && !!(guest_token || explicitGuestTokenHeader);

    let activeProfileId: string | null = null;
    if (!isExplicitGuest) {
      const resolvedProfile = await resolveServerActiveProfile(request);
      activeProfileId = resolvedProfile?.activeProfileId ?? null;
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // ตรวจสอบว่าเป็น admin หรือ sub_admin — ถ้าใช่ ข้ามการบันทึก
    if (activeProfileId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role, is_sub_account, parent_admin_id')
        .eq('id', activeProfileId)
        .maybeSingle();

      const isAdmin = profile?.role === 'admin';
      const isSubAdmin = !!(profile?.is_sub_account && profile?.parent_admin_id);
      if (isAdmin || isSubAdmin) {
        // ไม่บันทึกประวัติของ admin / sub_admin
        return NextResponse.json({ ok: true }, { headers: corsHeaders });
      }
    }

    const actorRole: FilterActorRole = activeProfileId ? 'user' : 'guest';
    const effectiveGuestToken = activeProfileId ? null : (guest_token || explicitGuestTokenHeader || null);

    // ต้องมีตัวตนอย่างน้อยหนึ่งอย่าง
    if (!activeProfileId && !effectiveGuestToken) {
      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    const row = {
      user_id: activeProfileId,
      guest_token: effectiveGuestToken,
      actor_role: actorRole,
      province: (province && province.length > 0) ? province : null,
      min_price_kip,
      max_price_kip,
      display_currency: (min_price_kip != null || max_price_kip != null) ? display_currency : null,
      price_sort_order,
      latest_post_first,
    };

    const { error } = await adminClient.from('filter_search_logs').insert(row);
    if (error) {
      return internalServerError('filter/log insert failed', error);
    }

    console.log(`[Filter Log] actor=${actorRole} province=${province ?? '-'} price=${min_price_kip ?? '-'}-${max_price_kip ?? '-'} sort=${price_sort_order ?? '-'} latest=${latest_post_first === true ? '1' : '-'}`);
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    return internalServerError('filter/log unexpected error', e);
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
