import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { canActivateCarBoost, setCarBoosted } from '@/lib/activateBoostedCar';

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
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'boost:activate-car',
      identifier: ip,
      limit: 30,
      windowSeconds: 60,
    });
    if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    let authUserId: string | null = null;
    if (bearerToken) {
      const { data: { user } } = await admin.auth.getUser(bearerToken);
      authUserId = user?.id ?? null;
    }
    if (!authUserId) {
      const resolved = await resolveServerActiveProfile(request);
      authUserId = resolved?.authUserId ?? null;
    }
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const { data: boostRows, error: boostError } = await admin
      .from('post_boosts')
      .select('id, post_id, user_id, status, expires_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (boostError) {
      return internalServerError('boost/activate-car load boost failed', boostError);
    }
    const boost = Array.isArray(boostRows) ? boostRows[0] : null;
    if (!boost || String(boost.status || '') !== 'success') {
      return NextResponse.json({ error: 'Active boost not found' }, { status: 404 });
    }

    const expiresAt = typeof boost.expires_at === 'string' ? boost.expires_at : null;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Boost expired' }, { status: 409 });
    }

    const { data: car, error: carError } = await admin
      .from('cars')
      .select('id, user_id, is_boosted')
      .eq('id', postId)
      .maybeSingle();

    if (carError) {
      return internalServerError('boost/activate-car load car failed', carError);
    }
    if (!car?.id) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const allowed = await canActivateCarBoost({
      admin,
      authUserId,
      carUserId: String(car.user_id || ''),
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await setCarBoosted(admin, postId, expiresAt);
    return NextResponse.json({ ok: true, is_boosted: updated.is_boosted === true });
  } catch (error) {
    return internalServerError('boost/activate-car POST failed', error);
  }
}
