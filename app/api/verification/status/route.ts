import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { tooManyRequests } from '@/lib/apiSecurity';

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rateLimit = await checkRateLimit({
    namespace: 'verification:status',
    identifier: ip,
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const resolvedProfile = await resolveServerActiveProfile(req);
  const userId = resolvedProfile?.activeProfileId ?? null;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get is_verified from profiles
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_verified')
    .eq('id', userId)
    .single();

  // Get latest verification request
  const { data: request } = await adminClient
    .from('verification_requests')
    .select('id, status, document_type, reject_reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If latest request is rejected, show rejected status regardless of is_verified flag
  let finalIsVerified = profile?.is_verified ?? false;
  if (request?.status === 'rejected') {
    finalIsVerified = false;
  }

  return NextResponse.json({
    is_verified: finalIsVerified,
    latest_request: request ?? null,
  });
}
