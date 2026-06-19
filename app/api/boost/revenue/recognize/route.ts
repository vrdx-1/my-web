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

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function resolveUserFromBearerToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!accessToken) {
    return null;
  }

  // Verify the token by calling Supabase auth endpoint
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      }
    );

    if (response.ok) {
      const userData = await response.json();
      console.log('[boost/revenue/recognize] Bearer token verified', { userId: userData.id });
      return userData.id;
    } else {
      const errorText = await response.text();
      console.warn('[boost/revenue/recognize] Bearer token verification failed', {
        statusCode: response.status,
        statusText: response.statusText,
        errorText,
      });
    }
  } catch (error) {
    console.error('[boost/revenue/recognize] Bearer token verification error', error);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const debug = {
      route: '/api/boost/revenue/recognize',
      stage: 'init',
    } as { route: string; stage: string; [key: string]: unknown };

    const admin = getAdminClient();
    if (!admin) {
      debug.stage = 'missing_service_role_key';
      return NextResponse.json({ error: 'Server configuration missing', debug }, { status: 503 });
    }

    // Try Bearer token first, then fallback to resolveServerActiveProfile (cookies)
    debug.stage = 'resolve_profile_bearer';
    let activeProfileId = await resolveUserFromBearerToken(request);

    if (!activeProfileId) {
      debug.stage = 'resolve_profile_cookie';
      const resolved = await resolveServerActiveProfile(request);
      activeProfileId = resolved?.activeProfileId || null;
    }

    if (!activeProfileId) {
      debug.stage = 'unauthorized';
      return NextResponse.json({ error: 'Unauthorized', debug }, { status: 401 });
    }

    debug.stage = 'body_parse';
    let body: RecognizeRevenueBody;
    try {
      body = await request.json();
    } catch (jsonError) {
      debug.stage = 'json_parse_error';
      return NextResponse.json({ error: 'Invalid JSON body', debug, details: String(jsonError) }, { status: 400 });
    }

    const boostId = typeof body?.boostId === 'string' ? body.boostId.trim() : '';
    const post_id = typeof body?.postId === 'string' ? body.postId.trim() : '';

    if (!boostId || !post_id) {
      debug.stage = 'invalid_body';
      debug.boostId = boostId;
      debug.post_id = post_id;
      return NextResponse.json({ error: 'boostId and postId are required', debug }, { status: 400 });
    }

    debug.stage = 'load_boost';
    const { data: boost, error: boostError } = await admin
      .from('post_boosts')
      .select('id, post_id, user_id, status, price')
      .eq('id', boostId)
      .maybeSingle();

    if (boostError) {
      debug.stage = 'load_boost_error';
      console.error('[boost/revenue/recognize] load boost failed', { debug, boostError });
      return NextResponse.json({ error: 'Load boost failed', debug, details: String(boostError?.message || boostError) }, { status: 500 });
    }
    if (!boost) {
      debug.stage = 'boost_not_found';
      return NextResponse.json({ error: 'Boost not found', debug }, { status: 404 });
    }

    const boostOwnerId = String(boost.user_id || '').trim();
    if (!boostOwnerId || boostOwnerId !== activeProfileId) {
      debug.stage = 'forbidden_owner_mismatch';
      debug.boostOwnerId = boostOwnerId;
      debug.activeProfileId = activeProfileId;
      return NextResponse.json({ error: 'Forbidden', debug }, { status: 403 });
    }

    if (String(boost.post_id || '') !== post_id) {
      debug.stage = 'post_mismatch';
      debug.boostPostId = String(boost.post_id || '');
      debug.requestPostId = post_id;
      return NextResponse.json({ error: 'Post mismatch', debug }, { status: 409 });
    }

    if (String(boost.status || '') !== 'success') {
      debug.stage = 'boost_not_success';
      debug.boostStatus = String(boost.status || '');
      return NextResponse.json({ ok: true, skipped: true, reason: 'boost_not_success', debug });
    }

    debug.stage = 'load_profile';
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, is_sub_account, parent_admin_id')
      .eq('id', activeProfileId)
      .maybeSingle();

    if (profileError) {
      debug.stage = 'load_profile_error';
      console.error('[boost/revenue/recognize] load profile failed', { debug, profileError });
      return NextResponse.json({ error: 'Load profile failed', debug, details: String(profileError?.message || profileError) }, { status: 500 });
    }

    const role = String(profile?.role || '').trim().toLowerCase();
    const isSubAccount = profile?.is_sub_account === true;
    const isAdmin = role === 'admin';

    if (isAdmin || isSubAccount) {
      debug.stage = 'excluded_role';
      debug.reason = isAdmin ? 'admin_role' : 'sub_account';
      return NextResponse.json({ ok: true, excluded: true, reason: debug.reason, debug });
    }

    const rawAmount = Number(boost.price);
    const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;

    debug.stage = 'insert_revenue_log';
    debug.amountCalculation = {
      rawAmount,
      amount,
    };

    const { error: upsertError } = await admin
      .from('revenue_logs')
      .upsert(
        {
          source_type: 'boost_post',
          source_boost_id: String(boost.id),
          post_id,
          payer_user_id: activeProfileId,
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
      debug.stage = 'insert_revenue_log_error';
      console.error('[boost/revenue/recognize] revenue log insert failed', { debug, upsertError });
      return NextResponse.json(
        {
          error: 'Revenue log insert failed',
          debug,
          details: String(upsertError?.message || upsertError),
        },
        { status: 500 }
      );
    }

    debug.stage = 'done';
    return NextResponse.json({ ok: true, debug });
  } catch (error) {
    console.error('[boost/revenue/recognize] unexpected error', { error });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Unexpected error in revenue recognize',
        details: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 }
    );
  }
}
