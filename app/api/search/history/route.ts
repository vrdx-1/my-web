import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { internalServerError } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

type SearchHistoryActor =
  | { kind: 'user'; profileId: string }
  | { kind: 'guest'; guestToken: string };

function normalizeSearchTerm(input: string): { searchTerm: string; termKey: string } {
  const searchTerm = input.trim().slice(0, 200);
  const termKey = searchTerm.toLocaleLowerCase();
  return { searchTerm, termKey };
}

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const sharedCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-guest-token, x-active-profile-id',
  ...noStoreHeaders,
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: sharedCorsHeaders });
}

function normalizeGuestToken(input: string | null | undefined): string | null {
  const guestToken = String(input ?? '').trim();
  return guestToken ? guestToken.slice(0, 200) : null;
}

async function loadGuestHistoryFromSearchLogs(admin: ReturnType<typeof createAdminClient>, guestToken: string, limit: number) {
  if (!admin) {
    return { items: [], error: null } as const;
  }

  const fetchLimit = Math.min(200, Math.max(20, limit * 5));
  const { data, error } = await admin
    .from('search_logs')
    .select('search_term, display_text, created_at')
    .eq('guest_token', guestToken)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (error) {
    return { items: [], error } as const;
  }

  const seen = new Set<string>();
  const items = (data || [])
    .map((row) => ({
      search_term: row.search_term,
      display_text: row.display_text ?? row.search_term,
      last_search_type: 'manual',
      search_count: 1,
      last_searched_at: row.created_at,
    }))
    .filter((row) => {
      const key = normalizeSearchTerm(row.search_term).termKey;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);

  return { items, error: null } as const;
}

async function resolveSearchHistoryActor(
  request: NextRequest,
  guestTokenHint?: string | null,
): Promise<SearchHistoryActor | null> {
  // Check explicit guest token FIRST to avoid cookie/session bleed-through on mobile
  // webviews and PWA where the server may still see stale auth cookies after client logout.
  const explicitGuestToken = normalizeGuestToken(
    guestTokenHint
      ?? request.headers.get('x-guest-token')
      ?? request.nextUrl.searchParams.get('guest_token')
  );

  if (explicitGuestToken) {
    return { kind: 'guest', guestToken: explicitGuestToken };
  }

  const resolved = await resolveServerActiveProfile(request);
  if (resolved?.activeProfileId) {
    return { kind: 'user', profileId: resolved.activeProfileId };
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveSearchHistoryActor(request);
    if (!actor) {
      console.log('[DEBUG] No actor resolved for search/history');
      return NextResponse.json({ items: [] }, { headers: noStoreHeaders });
    }

    // DEBUG: log actor info
    if (actor.kind === 'guest') {
      console.log('[DEBUG] guestToken received in API:', actor.guestToken);
    } else {
      console.log('[DEBUG] userId received in API:', actor.profileId);
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const limitRaw = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 20;

    const corsHeaders = sharedCorsHeaders;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (actor.kind === 'guest') {
      console.log('[DEBUG] guestToken used in DB query:', actor.guestToken);
      const guestHistory = await loadGuestHistoryFromSearchLogs(admin, actor.guestToken, limit);
      if (guestHistory.error) {
        return internalServerError('search/history guest fallback failed', guestHistory.error);
      }
      return NextResponse.json({ items: guestHistory.items }, { headers: corsHeaders });
    }

    const { data, error } = await admin
      .from('user_search_history')
      .select('search_term, display_text, last_search_type, search_count, last_searched_at')
      .eq('user_id', actor.profileId)
      .eq('is_deleted', false)
      .order('last_searched_at', { ascending: false })
      .limit(limit);

    if (error) {
      return internalServerError('search/history get failed', error);
    }

    return NextResponse.json({ items: data || [] }, { headers: corsHeaders });
  } catch (e) {
    return internalServerError('search/history unexpected error', e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await resolveSearchHistoryActor(
      request,
      typeof body?.guest_token === 'string' ? body.guest_token : null,
    );
    if (!actor) {
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const rawSearchTerm = typeof body?.search_term === 'string' ? body.search_term : '';
    const { searchTerm, termKey } = normalizeSearchTerm(rawSearchTerm);

    if (actor.kind === 'guest') {
      let deleteQuery = admin.from('search_logs').delete().eq('guest_token', actor.guestToken);
      if (searchTerm) {
        deleteQuery = deleteQuery.eq('search_term', searchTerm);
      }

      const { error } = await deleteQuery;
      if (error) {
        return internalServerError('search/history guest delete failed', error);
      }

      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    if (!searchTerm) {
      // Soft delete all history for this user
      const { error } = await admin
        .from('user_search_history')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('user_id', actor.profileId)
        .eq('is_deleted', false);
      if (error) {
        return internalServerError('search/history clear failed', error);
      }
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    // Soft delete single item
    const { error } = await admin
      .from('user_search_history')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('user_id', actor.profileId)
      .eq('term_key', termKey)
      .eq('is_deleted', false);

    if (error) {
      return internalServerError('search/history delete item failed', error);
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (e) {
    return internalServerError('search/history unexpected error', e);
  }
}
