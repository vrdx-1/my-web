import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { internalServerError } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

type RepostClickActorProfile = {
  id: string;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type CarLookupRow = {
  id: string;
  user_id: string;
  status: string | null;
};

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const postId = typeof body?.post_id === 'string' ? body.post_id.trim() : '';

    if (!postId) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'missing_post_id' });
    }

    if (!isUuid(postId)) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'invalid_post_id_format' });
    }

    const resolved = await resolveServerActiveProfile(request);
    if (!resolved?.activeProfileId) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'no_active_profile' });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: 'Server configuration missing', skipped: true, skipped_reason: 'missing_service_role' },
        { status: 503 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, is_sub_account, parent_admin_id')
      .eq('id', resolved.activeProfileId)
      .maybeSingle();

    if (profileError) {
      return internalServerError('analytics/repost-click profile lookup failed', profileError);
    }

    const typedProfile = profile as RepostClickActorProfile | null;
    if (!typedProfile?.id) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: 'profile_not_found',
        actor_profile_id: resolved.activeProfileId,
      });
    }

    const isAdminActor = typedProfile.role === 'admin';
    const isSubAccountActor = Boolean(typedProfile.is_sub_account && typedProfile.parent_admin_id);

    if (isAdminActor || isSubAccountActor) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: isAdminActor ? 'admin_actor' : 'sub_account_actor',
        actor_profile_id: resolved.activeProfileId,
      });
    }

    const { data: car, error: carError } = await admin
      .from('cars')
      .select('id, user_id, status')
      .eq('id', postId)
      .maybeSingle();

    if (carError) {
      return internalServerError('analytics/repost-click car lookup failed', carError);
    }

    const typedCar = car as CarLookupRow | null;
    if (!typedCar?.id) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'post_not_found' });
    }

    if (typedCar.user_id !== resolved.activeProfileId) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: 'not_post_owner',
      });
    }

    if (typedCar.status !== 'recommend') {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: 'post_not_recommend',
      });
    }

    const { error: insertError } = await admin
      .from('repost_click_events')
      .insert({
        post_id: typedCar.id,
        user_id: resolved.activeProfileId,
      });

    if (insertError) {
      return internalServerError('analytics/repost-click insert failed', insertError);
    }

    return NextResponse.json({
      ok: true,
      inserted: true,
      actor_profile_id: resolved.activeProfileId,
      post_id: typedCar.id,
    });
  } catch (error) {
    return internalServerError('analytics/repost-click unexpected error', error);
  }
}
