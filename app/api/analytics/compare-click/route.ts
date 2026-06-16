import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { internalServerError } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

type CompareClickActorProfile = {
  id: string;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const hasAuthorizationHeader = Boolean(
      request.headers.get('authorization') || request.headers.get('Authorization'),
    );
    const hasActiveProfileHeader = Boolean(request.headers.get('x-active-profile-id'));

    const body = await request.json().catch(() => ({}));
    const postId = typeof body?.post_id === 'string' ? body.post_id.trim() : '';
    if (!postId) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'missing_post_id' });
    }

    const resolved = await resolveServerActiveProfile(request);
    if (!resolved?.activeProfileId) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: 'no_active_profile',
        has_authorization_header: hasAuthorizationHeader,
        has_active_profile_header: hasActiveProfileHeader,
      });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing', skipped: true, skipped_reason: 'missing_service_role' }, { status: 503 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, is_sub_account, parent_admin_id')
      .eq('id', resolved.activeProfileId)
      .maybeSingle();

    if (profileError) {
      return internalServerError('analytics/compare-click profile lookup failed', profileError);
    }

    const typedProfile = profile as CompareClickActorProfile | null;
    if (!typedProfile?.id) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: 'profile_not_found',
        actor_profile_id: resolved.activeProfileId,
      });
    }

    const isAdminActor = typedProfile?.role === 'admin';
    const isSubAccountActor = Boolean(typedProfile?.is_sub_account && typedProfile?.parent_admin_id);

    if (isAdminActor || isSubAccountActor) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: isAdminActor ? 'admin_actor' : 'sub_account_actor',
        actor_profile_id: resolved.activeProfileId,
      });
    }

    let insertPostId: string | null = null;
    let postIdSkipReason: string | null = null;

    if (!isUuid(postId)) {
      postIdSkipReason = 'invalid_post_id_format';
    } else {
      const { data: car, error: carError } = await admin
        .from('cars')
        .select('id')
        .eq('id', postId)
        .maybeSingle();

      if (carError) {
        return internalServerError('analytics/compare-click car lookup failed', carError);
      }

      if (car?.id) {
        insertPostId = car.id;
      } else {
        postIdSkipReason = 'post_not_found';
      }
    }

    const { error: insertError } = await admin
      .from('compare_usage_logs')
      .insert({
        user_id: resolved.activeProfileId,
        post_id: insertPostId,
      });

    if (insertError) {
      return internalServerError('analytics/compare-click insert failed', insertError);
    }

    return NextResponse.json({
      ok: true,
      inserted: true,
      actor_profile_id: resolved.activeProfileId,
      post_id_recorded: Boolean(insertPostId),
      post_id_skip_reason: postIdSkipReason,
    });
  } catch (error) {
    return internalServerError('analytics/compare-click unexpected error', error);
  }
}