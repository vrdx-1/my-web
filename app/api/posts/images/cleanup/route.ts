import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { getStorageObjectPaths } from '@/utils/storageObjectPath';
import { isOwnedByServerProfileScope } from '@/utils/serverOwnedProfiles';

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

type CleanupBody = {
  postId?: string;
  removedImages?: string[];
  guestToken?: string | null;
};

export async function POST(request: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let body: CleanupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
  const guestToken = typeof body?.guestToken === 'string' ? body.guestToken.trim() : '';
  const removedImages = Array.isArray(body?.removedImages)
    ? body.removedImages.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 });
  }

  if (removedImages.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const resolvedProfile = await resolveServerActiveProfile(request);
  const { data: post, error: postError } = await admin
    .from('cars')
    .select('id, user_id, guest_token')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const isOwnedByProfile = await isOwnedByServerProfileScope(admin, post.user_id, {
    activeProfileId: resolvedProfile?.activeProfileId ?? null,
    authUserId: resolvedProfile?.authUserId ?? null,
  });
  const isOwnedByGuest = !!guestToken && !!post.guest_token && String(post.guest_token) === guestToken;

  if (!isOwnedByProfile && !isOwnedByGuest) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const imagePaths = getStorageObjectPaths(removedImages, POSTS_BUCKET);
  if (imagePaths.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const { error: storageError } = await admin.storage.from(POSTS_BUCKET).remove(imagePaths);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: imagePaths.length });
}