import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { getStorageObjectPaths } from '@/utils/storageObjectPath';
import { isOwnedByServerProfileScope } from '@/utils/serverOwnedProfiles';
import { ACTIVE_PROFILE_HEADER } from '@/utils/activeProfile';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';

const POSTS_BUCKET = 'car-images';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

type DeletePostBody = {
  postId?: string;
  guestToken?: string | null;
};

export async function DELETE(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'posts:delete',
    identifier: ip,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let body: DeletePostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
  const guestToken = typeof body?.guestToken === 'string' ? body.guestToken.trim() : '';

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 });
  }

  // Auth: use admin client for reliable JWT verification (more reliable than SSR cookie client)
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

  // Fallback to SSR cookie-based auth
  if (!resolvedAuthUserId) {
    const resolvedProfile = await resolveServerActiveProfile(request);
    resolvedAuthUserId = resolvedProfile?.authUserId ?? null;
    resolvedActiveProfileId = resolvedProfile?.activeProfileId ?? null;
  }

  const { data: post, error: postError } = await admin
    .from('cars')
    .select('id, user_id, guest_token, images')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    return internalServerError('posts/delete load post failed', postError);
  }
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const isOwnedByProfile = await isOwnedByServerProfileScope(admin, post.user_id, {
    activeProfileId: resolvedActiveProfileId,
    authUserId: resolvedAuthUserId,
  });
  const isOwnedByGuest = !!guestToken && !!post.guest_token && String(post.guest_token) === guestToken;

  if (!isOwnedByProfile && !isOwnedByGuest) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const imageValues = Array.isArray(post.images)
    ? post.images.filter((value): value is string => typeof value === 'string')
    : [];
  const imagePaths = getStorageObjectPaths(imageValues, POSTS_BUCKET);

  if (imagePaths.length > 0) {
    const { error: storageError } = await admin.storage.from(POSTS_BUCKET).remove(imagePaths);
    if (storageError) {
      return internalServerError('posts/delete storage remove failed', storageError);
    }
  }

  const { error: deleteError } = await admin.from('cars').delete().eq('id', postId);
  if (deleteError) {
    return internalServerError('posts/delete db delete failed', deleteError);
  }

  return NextResponse.json({ ok: true });
}