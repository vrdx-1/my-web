import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { internalServerError } from '@/lib/apiSecurity';

type RecognizeRevenueBody = {
  boostId?: string;
  postId?: string;
};

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const resolved = await resolveServerActiveProfile(request);
  if (!resolved?.activeProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RecognizeRevenueBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const boostId = typeof body?.boostId === 'string' ? body.boostId.trim() : '';
  const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';

  if (!boostId || !postId) {
    return NextResponse.json({ error: 'boostId and postId are required' }, { status: 400 });
  }

  const { data: boost, error: boostError } = await admin
    .from('post_boosts')
    .select('id, post_id, user_id, status, price')
    .eq('id', boostId)
    .maybeSingle();

  if (boostError) {
    return internalServerError('boost/revenue/recognize load boost failed', boostError);
  }
  if (!boost) {
    return NextResponse.json({ error: 'Boost not found' }, { status: 404 });
  }

  const boostOwnerId = String(boost.user_id || '').trim();
  if (!boostOwnerId || boostOwnerId !== resolved.activeProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (String(boost.post_id || '') !== postId) {
    return NextResponse.json({ error: 'Post mismatch' }, { status: 409 });
  }

  if (String(boost.status || '') !== 'success') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'boost_not_success' });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_sub_account, parent_admin_id')
    .eq('id', resolved.activeProfileId)
    .maybeSingle();

  if (profileError) {
    return internalServerError('boost/revenue/recognize load profile failed', profileError);
  }

  const role = String(profile?.role || '').trim().toLowerCase();
  const isSubAccount = profile?.is_sub_account === true;
  const isAdmin = role === 'admin';

  if (isAdmin || isSubAccount) {
    return NextResponse.json({ ok: true, excluded: true, reason: isAdmin ? 'admin_role' : 'sub_account' });
  }

  const rawAmount = Number(boost.price);
  const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;

  const { error: upsertError } = await admin
    .from('revenue_logs')
    .upsert(
      {
        source_type: 'boost_post',
        source_boost_id: String(boost.id),
        post_id,
        payer_user_id: resolved.activeProfileId,
        payer_role_snapshot: role || null,
        payer_is_sub_account_snapshot: isSubAccount,
        payer_parent_admin_id_snapshot: profile?.parent_admin_id || null,
        event_type: 'boost_revenue_recognized',
        amount,
        currency: 'LAK',
        event_at: new Date().toISOString(),
        reason_code: 'boost_confirmed',
        note: null,
        metadata: { via: 'boost_slip_confirm' },
      },
      { onConflict: 'source_boost_id,event_type', ignoreDuplicates: true },
    );

  if (upsertError) {
    return internalServerError('boost/revenue/recognize upsert failed', upsertError);
  }

  return NextResponse.json({ ok: true });
}
