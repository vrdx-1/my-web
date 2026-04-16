import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ACTIVE_PROFILE_HEADER } from '@/utils/activeProfile';

type ResolvedActiveProfile = {
  authUserId: string;
  activeProfileId: string;
};

export async function resolveServerActiveProfile(request: Request | NextRequest): Promise<ResolvedActiveProfile | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  let userId: string | null = null;

  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  if (cookieUser?.id) {
    userId = cookieUser.id;
  }

  if (!userId) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (accessToken) {
      const { data: { user: headerUser } } = await supabase.auth.getUser(accessToken);
      if (headerUser?.id) {
        userId = headerUser.id;
      }
    }
  }

  if (!userId) return null;

  const requestedProfileId = request.headers.get(ACTIVE_PROFILE_HEADER)?.trim() || userId;

  if (requestedProfileId === userId) {
    return { authUserId: userId, activeProfileId: userId };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', requestedProfileId)
    .eq('parent_admin_id', userId)
    .maybeSingle();

  if (!profile?.id) {
    return { authUserId: userId, activeProfileId: userId };
  }

  return { authUserId: userId, activeProfileId: profile.id };
}