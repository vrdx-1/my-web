import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

type FeedCacheStatus = 'recommend' | 'sold';

type FeedActor =
  | { actorColumn: 'user_id'; actorValue: string; actorKey: string; user_id: string; guest_token: null }
  | { actorColumn: 'guest_token'; actorValue: string; actorKey: string; user_id: null; guest_token: string };

function createServiceClient(): any | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

function normalizeGuestToken(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const token = input.trim();
  if (!token || token === 'null' || token === 'undefined') return null;
  return token.slice(0, 200);
}

function resolveFeedStatus(value: unknown): FeedCacheStatus {
  return value === 'sold' ? 'sold' : 'recommend';
}

function buildFeedScope(status: FeedCacheStatus, province?: string): string {
  const normalizedProvince = province?.trim() || 'all';
  return `${status}:${normalizedProvince}`;
}

async function resolveFeedActor(request: NextRequest, bodyGuestToken?: unknown): Promise<FeedActor | null> {
  const queryGuestToken = normalizeGuestToken(request.nextUrl.searchParams.get('guestToken'));
  const headerGuestToken = normalizeGuestToken(request.headers.get('x-guest-token'));
  const explicitGuestToken = normalizeGuestToken(bodyGuestToken) || headerGuestToken || queryGuestToken;

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const hasExplicitBearerAuth = !!authHeader?.startsWith('Bearer ');
  const isExplicitGuest = !hasExplicitBearerAuth && !!explicitGuestToken;

  if (!isExplicitGuest) {
    const resolvedProfile = await resolveServerActiveProfile(request);
    if (resolvedProfile?.activeProfileId) {
      return {
        actorColumn: 'user_id',
        actorValue: resolvedProfile.activeProfileId,
        actorKey: `user:${resolvedProfile.activeProfileId}`,
        user_id: resolvedProfile.activeProfileId,
        guest_token: null,
      };
    }
  }

  if (explicitGuestToken) {
    return {
      actorColumn: 'guest_token',
      actorValue: explicitGuestToken,
      actorKey: `guest:${explicitGuestToken}`,
      user_id: null,
      guest_token: explicitGuestToken,
    };
  }

  return null;
}

async function getCurrentCycleNo(admin: any, actor: FeedActor, scope: string): Promise<number> {
  const { data: existing, error } = await admin
    .from('feed_actor_cycle_state')
    .select('cycle_no')
    .eq('actor_key', actor.actorKey)
    .eq('feed_scope', scope)
    .maybeSingle();

  if (!error && existing?.cycle_no && Number(existing.cycle_no) > 0) {
    return Number(existing.cycle_no);
  }

  const { error: upsertError } = await admin
    .from('feed_actor_cycle_state')
    .upsert(
      {
        user_id: actor.user_id,
        guest_token: actor.guest_token,
        actor_key: actor.actorKey,
        feed_scope: scope,
        cycle_no: 1,
        last_reset_at: new Date().toISOString(),
      },
      { onConflict: 'actor_key,feed_scope' }
    );

  if (upsertError) {
    console.error('[feed/impressions] feed_actor_cycle_state upsert failed:', upsertError.message);
  }

  return 1;
}

function sanitizePostIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((id) => id.length > 0)
    .slice(0, 200);
  return Array.from(new Set(ids));
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:feed:impressions',
      identifier: ip,
      limit: 240,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const body = await request.json().catch(() => ({}));
    const postIds = sanitizePostIds(body.postIds);
    if (postIds.length === 0) {
      return NextResponse.json({ ok: true, tracked: 0 });
    }

    const province = typeof body.province === 'string' ? body.province : undefined;
    const status = resolveFeedStatus(body.status);
    const actor = await resolveFeedActor(request, body.guestToken ?? body.guest_token);

    if (!actor) {
      return NextResponse.json({ ok: true, tracked: 0, reason: 'no-actor' });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const db = (createServiceClient() || supabase) as any;
    const scope = buildFeedScope(status, province);
    const cycleNo = await getCurrentCycleNo(db, actor, scope);

    const { data: rows, error: fetchError } = await db
      .from('cars')
      .select('id, is_boosted, status, is_hidden')
      .in('id', postIds);

    if (fetchError) {
      return internalServerError('feed/impressions post check failed', fetchError);
    }

    const regularVisiblePostIds = (rows || [])
      .filter((row: { id: string; is_boosted: boolean | null; status: string; is_hidden: boolean | null }) =>
        row && !row.is_boosted && row.status === status && !row.is_hidden,
      )
      .map((row: { id: string }) => row.id);

    if (regularVisiblePostIds.length === 0) {
      return NextResponse.json({ ok: true, tracked: 0 });
    }

    const payload = regularVisiblePostIds.map((postId) => ({
      post_id: postId,
      user_id: actor.user_id,
      guest_token: actor.guest_token,
      actor_key: actor.actorKey,
      feed_scope: scope,
      cycle_no: cycleNo,
      seen_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await db
      .from('feed_impressions')
      .upsert(payload, {
        onConflict: 'actor_key,feed_scope,cycle_no,post_id',
      });

    if (upsertError) {
      return internalServerError('feed/impressions upsert failed', upsertError);
    }

    return NextResponse.json({ ok: true, tracked: regularVisiblePostIds.length });
  } catch (err) {
    return internalServerError('feed/impressions POST failed', err);
  }
}
