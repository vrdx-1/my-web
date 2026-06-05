import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

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
  const isSubAdmin = profile?.is_sub_account === true;
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'analytics:exchange-rate-popup-click',
    identifier: ip,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    const resolvedProfile = await resolveServerActiveProfile(request);
    const activeProfileId = resolvedProfile?.activeProfileId ?? null;
  } = await supabase.auth.getUser();

    if (activeProfileId) {
      const { data: profile } = await admin
  // ไม่นับการกดของ admin และ sub-account ของ admin
        .select('role, is_sub_account, parent_admin_id')
        .eq('id', activeProfileId)
      .from('profiles')
      .select('role, is_sub_account')
      const isAdmin = profile?.role === 'admin';
      const isSubAdmin = Boolean(profile?.is_sub_account && profile?.parent_admin_id);

      if (isAdmin || isSubAdmin) {
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
