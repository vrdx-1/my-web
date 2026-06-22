import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type PostSaveRow = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_sub_account: boolean | null;
  parent_admin_id: string | null;
};

type CarRow = {
  id: string;
  user_id: string | null;
  short_id: string | null;
  caption: string | null;
  images: string[] | null;
  layout: string | null;
  status: string | null;
  created_at: string;
  likes: number | null;
  shares: number | null;
  is_hidden: boolean | null;
  is_boosted: boolean | null;
  profiles:
    | {
        username: string | null;
        avatar_url: string | null;
        phone: string | null;
        is_verified: boolean | null;
      }
    | Array<{
        username: string | null;
        avatar_url: string | null;
        phone: string | null;
        is_verified: boolean | null;
      }>
    | null;
  price: number | null;
  price_currency: string | null;
  province: string | null;
};

function routeError(stage: string, err: unknown) {
  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  return NextResponse.json(
    {
      error: `Post saves API failed at ${stage}`,
      stage,
      message: anyErr?.message || 'Unknown error',
      code: anyErr?.code || null,
      details: anyErr?.details || null,
      hint: anyErr?.hint || null,
    },
    { status: 500 }
  );
}

async function ensureAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { ok: false, status: 401 as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }

  return { ok: true };
}

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

function personLabel(profile: ProfileRow | null, userId: string): string {
  const fullName = (profile?.full_name || profile?.display_name || profile?.name || '').trim();
  const username = (profile?.username || '').trim();
  if (fullName && username) return `${fullName} (@${username})`;
  if (fullName) return fullName;
  if (username) return `@${username}`;
  return `User ${userId.slice(0, 8)}`;
}

function isNormalUser(profile: ProfileRow | null): boolean {
  if (!profile) return true;
  if (profile.role === 'admin') return false;
  if (profile.is_sub_account && profile.parent_admin_id) return false;
  return true;
}

function formatPostCode(shortId: string | null, postId: string) {
  if (shortId) return `#${shortId}`;
  return postId.slice(0, 8);
}

function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => !!item);
}

export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const { searchParams } = request.nextUrl;
    const start = searchParams.get('start') || null;
    const end = searchParams.get('end') || null;
    const saverKey = toStringOrNull(searchParams.get('saverKey'));
    const limitRaw = parseInt(searchParams.get('limit') || '5000', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(10000, Math.max(100, limitRaw)) : 5000;

    let savesQuery = admin
      .from('post_saves')
      .select('id, user_id, post_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start) savesQuery = savesQuery.gte('created_at', new Date(start).toISOString());
    if (end) savesQuery = savesQuery.lte('created_at', new Date(end).toISOString());

    const { data: rawSaves, error: savesError } = await savesQuery;
    if (savesError) return routeError('post_saves_query', savesError);

    const saves = ((rawSaves as PostSaveRow[] | null) || [])
      .filter((row) => !!row.id && !!row.user_id && !!row.post_id);

    const saverIds = Array.from(new Set(saves.map((row) => row.user_id)));
    const postIds = Array.from(new Set(saves.map((row) => row.post_id)));

    const profileMap = new Map<string, ProfileRow>();
    let profileWarning: string | null = null;

    if (saverIds.length > 0) {
      const { data: rawProfiles, error: profilesError } = await admin
        .from('profiles')
        .select('*')
        .in('id', saverIds);

      if (profilesError) {
        profileWarning = `saver_profiles_query_failed: ${profilesError.message || 'unknown error'}`;
      } else {
        for (const row of (rawProfiles as Record<string, unknown>[] | null) || []) {
          const id = toStringOrNull(row.id);
          if (!id) continue;
          profileMap.set(id, {
            id,
            username: toStringOrNull(row.username) || toStringOrNull(row.user_name),
            full_name: toStringOrNull(row.full_name),
            display_name: toStringOrNull(row.display_name),
            name: toStringOrNull(row.name),
            avatar_url: toStringOrNull(row.avatar_url) || toStringOrNull(row.avatar),
            role: toStringOrNull(row.role),
            is_sub_account: toBooleanOrNull(row.is_sub_account),
            parent_admin_id: toStringOrNull(row.parent_admin_id),
          });
        }
      }
    }

    const { data: rawCars, error: carsError } = postIds.length > 0
        ? await admin
          .from('cars')
            .select('id, user_id, short_id, caption, images, layout, status, created_at, likes, shares, is_hidden, is_boosted, price, price_currency, province, profiles(username, avatar_url, phone, is_verified)')
          .in('id', postIds)
      : { data: [], error: null };

    if (carsError) return routeError('cars_query', carsError);

    const carMap = new Map<string, CarRow>();
    const ownerIds = new Set<string>();
    for (const row of (rawCars as CarRow[] | null) || []) {
      carMap.set(row.id, {
        ...row,
        images: normalizeImages(row.images),
      });
      if (row.user_id) ownerIds.add(row.user_id);
    }

    const missingOwnerIds = Array.from(ownerIds).filter((id) => !profileMap.has(id));
    if (missingOwnerIds.length > 0) {
      const { data: ownerProfiles, error: ownerProfilesError } = await admin
        .from('profiles')
        .select('*')
        .in('id', missingOwnerIds);

      if (!ownerProfilesError) {
        for (const row of (ownerProfiles as Record<string, unknown>[] | null) || []) {
          const id = toStringOrNull(row.id);
          if (!id) continue;
          if (!profileMap.has(id)) {
            profileMap.set(id, {
              id,
              username: toStringOrNull(row.username) || toStringOrNull(row.user_name),
              full_name: toStringOrNull(row.full_name),
              display_name: toStringOrNull(row.display_name),
              name: toStringOrNull(row.name),
              avatar_url: toStringOrNull(row.avatar_url) || toStringOrNull(row.avatar),
              role: toStringOrNull(row.role),
              is_sub_account: toBooleanOrNull(row.is_sub_account),
              parent_admin_id: toStringOrNull(row.parent_admin_id),
            });
          }
        }
      }
    }

    const visibleLogs = saves
      .map((row) => {
        const saver = profileMap.get(row.user_id) || null;
        if (!isNormalUser(saver)) return null;

        const car = carMap.get(row.post_id) || null;
        const ownerProfile = car?.user_id ? (profileMap.get(car.user_id) || null) : null;

        const person_key = `user:${row.user_id}`;
        const person_label = personLabel(saver, row.user_id);
        const ownerLabel = car?.user_id ? personLabel(ownerProfile, car.user_id) : 'Unknown owner';

        return {
          id: row.id,
          created_at: row.created_at,
          user_id: row.user_id,
          person_key,
          person_label,
          avatar_url: saver?.avatar_url || null,
          post_id: row.post_id,
          post_code: formatPostCode(car?.short_id || null, row.post_id),
          caption: car?.caption || null,
          images: car?.images || [],
          price: car?.price || null,
          price_currency: car?.price_currency || null,
          province: car?.province || null,
          post_owner_id: car?.user_id || null,
          post_owner_label: ownerLabel,
          post: car,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const scopedLogs = saverKey
      ? visibleLogs.filter((row) => row.person_key === saverKey)
      : visibleLogs;

    const peopleMap = new Map<string, {
      person_key: string;
      person_label: string;
      avatar_url: string | null;
      total_saves: number;
      last_saved_at: string;
    }>();

    for (const row of visibleLogs) {
      const existing = peopleMap.get(row.person_key);
      if (!existing) {
        peopleMap.set(row.person_key, {
          person_key: row.person_key,
          person_label: row.person_label,
          avatar_url: row.avatar_url,
          total_saves: 1,
          last_saved_at: row.created_at,
        });
      } else {
        existing.total_saves += 1;
        if (new Date(row.created_at) > new Date(existing.last_saved_at)) {
          existing.last_saved_at = row.created_at;
        }
      }
    }

    const people = Array.from(peopleMap.values()).sort((a, b) => {
      if (b.total_saves !== a.total_saves) return b.total_saves - a.total_saves;
      return new Date(b.last_saved_at).getTime() - new Date(a.last_saved_at).getTime();
    });

    const totalSaves = scopedLogs.length;
    const uniqueUsers = new Set(scopedLogs.map((row) => row.user_id)).size;
    const uniquePosts = new Set(scopedLogs.map((row) => row.post_id)).size;
    const avgSavesPerUser = uniqueUsers > 0 ? totalSaves / uniqueUsers : 0;

    return NextResponse.json({
      stats: {
        totalSaves,
        uniqueUsers,
        uniquePosts,
        avgSavesPerUser,
      },
      people,
      recentLogs: scopedLogs.slice(0, 300),
      warnings: profileWarning ? [profileWarning] : [],
    });
  } catch (error) {
    return routeError('unexpected', error);
  }
}