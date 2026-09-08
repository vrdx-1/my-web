import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { ACTIVE_PROFILE_HEADER } from '@/utils/activeProfile';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';

const ID_PAGE_SIZE = 1000;
const UPDATE_CHUNK_SIZE = 200;

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'posts:mark-all-sold',
    identifier: ip,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const activeProfileHeaderValue = request.headers.get(ACTIVE_PROFILE_HEADER)?.trim() ?? null;

  let resolvedAuthUserId: string | null = null;
  let resolvedActiveProfileId: string | null = null;

  if (bearerToken) {
    const { data: { user } } = await admin.auth.getUser(bearerToken);
    if (user?.id) {
      resolvedAuthUserId = user.id;
      resolvedActiveProfileId = activeProfileHeaderValue || user.id;
    }
  }

  if (!resolvedAuthUserId) {
    const resolvedProfile = await resolveServerActiveProfile(request);
    resolvedAuthUserId = resolvedProfile?.authUserId ?? null;
    resolvedActiveProfileId = resolvedProfile?.activeProfileId ?? null;
  }

  if (!resolvedAuthUserId || !resolvedActiveProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: actorProfile, error: actorError } = await admin
    .from('profiles')
    .select('id, is_sub_account, parent_admin_id')
    .eq('id', resolvedActiveProfileId)
    .maybeSingle();

  if (actorError) {
    return internalServerError('posts/mark-all-sold load actor failed', actorError);
  }

  const parentAdminId = actorProfile?.parent_admin_id ? String(actorProfile.parent_admin_id) : null;
  const isSubAccount = actorProfile?.is_sub_account === true && Boolean(parentAdminId);

  if (!actorProfile?.id || !isSubAccount) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetProfileId = String(actorProfile.id);
  const isActingAsSelf = String(resolvedAuthUserId) === targetProfileId;
  const isParentAdmin = String(resolvedAuthUserId) === parentAdminId;

  if (!isActingAsSelf && !isParentAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: parentProfile, error: parentError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', parentAdminId)
    .maybeSingle();

  if (parentError) {
    return internalServerError('posts/mark-all-sold load parent failed', parentError);
  }
  if (parentProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const postIds: string[] = [];
  let from = 0;
  while (true) {
    const { data: pageRows, error: pageError } = await admin
      .from('cars')
      .select('id')
      .eq('user_id', targetProfileId)
      .neq('status', 'sold')
      .range(from, from + ID_PAGE_SIZE - 1);

    if (pageError) {
      return internalServerError('posts/mark-all-sold list posts failed', pageError);
    }

    const rows = pageRows ?? [];
    for (const row of rows) {
      if (typeof row?.id === 'string' && row.id) postIds.push(row.id);
    }

    if (rows.length < ID_PAGE_SIZE) break;
    from += ID_PAGE_SIZE;
  }

  if (postIds.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  for (const chunk of chunkIds(postIds, UPDATE_CHUNK_SIZE)) {
    const { error: updateError } = await admin
      .from('cars')
      .update({
        status: 'sold',
        is_boosted: false,
        boost_expiry: null,
      })
      .in('id', chunk)
      .eq('user_id', targetProfileId)
      .neq('status', 'sold');

    if (updateError) {
      return internalServerError('posts/mark-all-sold update posts failed', updateError);
    }

    const { error: boostError } = await admin
      .from('post_boosts')
      .update({ status: 'reject' })
      .in('post_id', chunk)
      .eq('status', 'success');

    if (boostError) {
      return internalServerError('posts/mark-all-sold reject boosts failed', boostError);
    }
  }

  return NextResponse.json({ updated: postIds.length });
}
