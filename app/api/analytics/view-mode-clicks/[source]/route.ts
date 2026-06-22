import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { isViewModeAnalyticsSource, VIEW_MODE_ANALYTICS_CONFIG } from '@/utils/viewModeClickAnalytics';

type ActorProfileRow = {
  id: string;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ source: string }> }) {
  const { source } = await context.params;
  if (!isViewModeAnalyticsSource(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: `analytics:view-mode-clicks:${source}`,
    identifier: ip,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
  }

  const resolvedProfile = await resolveServerActiveProfile(request);
  if (!resolvedProfile?.activeProfileId) {
    return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'no_active_profile' });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_sub_account, parent_admin_id')
    .eq('id', resolvedProfile.activeProfileId)
    .maybeSingle();

  if (profileError) {
    return internalServerError('analytics/view-mode-clicks profile lookup failed', profileError);
  }

  const typedProfile = profile as ActorProfileRow | null;
  if (!typedProfile?.id) {
    return NextResponse.json({ ok: true, skipped: true, skipped_reason: 'profile_not_found' });
  }

  const isAdminActor = typedProfile.role === 'admin';
  const isSubAccountActor = Boolean(typedProfile.is_sub_account && typedProfile.parent_admin_id);

  if (isAdminActor || isSubAccountActor) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      skipped_reason: isAdminActor ? 'admin_actor' : 'sub_account_actor',
      actor_profile_id: resolvedProfile.activeProfileId,
      source,
    });
  }

  const { error: insertError } = await admin.from(VIEW_MODE_ANALYTICS_CONFIG[source].tableName).insert({
    user_id: resolvedProfile.activeProfileId,
  });

  if (insertError) {
    return internalServerError('analytics/view-mode-clicks insert failed', insertError);
  }

  return NextResponse.json({
    ok: true,
    inserted: true,
    actor_profile_id: resolvedProfile.activeProfileId,
    source,
  });
}