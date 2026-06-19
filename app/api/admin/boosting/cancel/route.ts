import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { internalServerError } from '@/lib/apiSecurity';

type CancelBoostBody = {
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

async function ensureAdmin(request: NextRequest): Promise<{ ok: true; adminClient: ReturnType<typeof createClient> } | { ok: false; status: 401 | 403 | 503 }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { ok: false, status: 503 };

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401 };

  const { data: { user } } = await adminClient.auth.getUser(token);
  const userId = user?.id ? String(user.id) : '';
  if (!userId) return { ok: false, status: 401 };

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (String(profile?.role || '').trim().toLowerCase() !== 'admin') {
    return { ok: false, status: 403 };
  }

  return { ok: true, adminClient };
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.ok) {
    const message = auth.status === 503 ? 'Server configuration missing' : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  const admin = auth.adminClient;

  let body: CancelBoostBody;
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
    .select('id, post_id, status')
    .eq('id', boostId)
    .maybeSingle();

  if (boostError) {
    return internalServerError('admin/boosting/cancel load boost failed', boostError);
  }
  if (!boost) {
    return NextResponse.json({ error: 'Boost not found' }, { status: 404 });
  }

  if (String(boost.post_id || '') !== postId) {
    return NextResponse.json({ error: 'Post mismatch' }, { status: 409 });
  }

  const { error: carUpdateError } = await admin
    .from('cars')
    .update({ is_boosted: false, boost_expiry: null })
    .eq('id', postId);

  if (carUpdateError) {
    return internalServerError('admin/boosting/cancel update car failed', carUpdateError);
  }

  const { error: boostUpdateError } = await admin
    .from('post_boosts')
    .update({ status: 'reject' })
    .eq('id', boostId);

  if (boostUpdateError) {
    return internalServerError('admin/boosting/cancel update boost failed', boostUpdateError);
  }

  const { data: recognizedLog, error: recognizedError } = await admin
    .from('revenue_logs')
    .select('source_boost_id, post_id, payer_user_id, payer_role_snapshot, payer_is_sub_account_snapshot, payer_parent_admin_id_snapshot, amount')
    .eq('source_boost_id', boostId)
    .eq('event_type', 'boost_revenue_recognized')
    .maybeSingle();

  if (recognizedError) {
    return internalServerError('admin/boosting/cancel load recognized log failed', recognizedError);
  }

  if (recognizedLog) {
    const amount = Number(recognizedLog.amount);
    const reverseAmount = Number.isFinite(amount) ? -Math.abs(amount) : 0;

    const { error: reverseError } = await admin
      .from('revenue_logs')
      .upsert(
        {
          source_type: 'boost_post',
          source_boost_id: boostId,
          post_id: recognizedLog.post_id || postId,
          payer_user_id: recognizedLog.payer_user_id || null,
          payer_role_snapshot: recognizedLog.payer_role_snapshot || null,
          payer_is_sub_account_snapshot: recognizedLog.payer_is_sub_account_snapshot === true,
          payer_parent_admin_id_snapshot: recognizedLog.payer_parent_admin_id_snapshot || null,
          event_type: 'boost_revenue_reversed',
          amount: reverseAmount,
          currency: 'LAK',
          event_at: new Date().toISOString(),
          reason_code: 'admin_cancel',
          note: null,
          metadata: { via: 'admin_cancel_boost' },
        },
        { onConflict: 'source_boost_id,event_type', ignoreDuplicates: true },
      );

    if (reverseError) {
      return internalServerError('admin/boosting/cancel reverse revenue failed', reverseError);
    }
  }

  return NextResponse.json({ ok: true });
}
