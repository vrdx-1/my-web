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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const requestedProfileId = request.headers.get(ACTIVE_PROFILE_HEADER)?.trim() || user.id;

  if (requestedProfileId === user.id) {
    return { authUserId: user.id, activeProfileId: user.id };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', requestedProfileId)
    .eq('parent_admin_id', user.id)
    .maybeSingle();

  if (!profile?.id) {
    return { authUserId: user.id, activeProfileId: user.id };
  }

  return { authUserId: user.id, activeProfileId: profile.id };
}