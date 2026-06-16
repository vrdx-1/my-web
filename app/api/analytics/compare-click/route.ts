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
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const postId = typeof body?.post_id === 'string' ? body.post_id.trim() : '';
    if (!postId) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'missing_post_id' });
    }

    const resolved = await resolveServerActiveProfile(request);
    if (!resolved?.activeProfileId) {
      return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'no_active_profile' });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing', skipped: true, skipped_reason: 'missing_service_role' }, { status: 503 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, is_sub_account, parent_admin_id')
      .eq('id', resolved.activeProfileId)
      .maybeSingle();

    if (profileError) {
      return internalServerError('analytics/compare-click profile lookup failed', profileError);
    }

    const typedProfile = profile as CompareClickActorProfile | null;
    const isAdminActor = typedProfile?.role === 'admin';
    const isSubAccountActor = Boolean(typedProfile?.is_sub_account && typedProfile?.parent_admin_id);

    if (isAdminActor || isSubAccountActor) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        skipped_reason: isAdminActor ? 'admin_actor' : 'sub_account_actor',
      });
    }

    const { error: insertError } = await admin
      .from('compare_usage_logs')
      .insert({
        user_id: resolved.activeProfileId,
        post_id: postId,
      });

    if (insertError) {
      return internalServerError('analytics/compare-click insert failed', insertError);
    }

    return NextResponse.json({ ok: true, inserted: true });
  } catch (error) {
    return internalServerError('analytics/compare-click unexpected error', error);
  }
}