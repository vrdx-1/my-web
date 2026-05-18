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

function normalizeGuestToken(input: string | null | undefined): string | null {
  const guestToken = String(input ?? '').trim();
  return guestToken ? guestToken.slice(0, 200) : null;
}

async function resolveSearchHistoryActor(
  request: NextRequest,
  guestTokenHint?: string | null,
): Promise<SearchHistoryActor | null> {
  const resolved = await resolveServerActiveProfile(request);
  if (resolved?.activeProfileId) {
    return { kind: 'user', profileId: resolved.activeProfileId };
  }

  const guestToken = normalizeGuestToken(
    guestTokenHint
      ?? request.headers.get('x-guest-token')
      ?? request.nextUrl.searchParams.get('guest_token')
  );

  if (!guestToken) {
    return null;
  }

  return { kind: 'guest', guestToken };
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

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...noStoreHeaders,
    };

    if (request.method === 'OPTIONS') {
      return NextResponse.json({}, { headers: corsHeaders });
    }

    let query = admin
      .from('user_search_history')
      .select('search_term, display_text, last_search_type, search_count, last_searched_at')
      .order('last_searched_at', { ascending: false })
      .limit(limit);

    if (actor.kind === 'user') {
      query = query.eq('user_id', actor.profileId);
    } else {
      query = query.eq('guest_token', actor.guestToken);
      // DEBUG: log guestToken used in DB query
      console.log('[DEBUG] guestToken used in DB query:', actor.guestToken);
    }

    const { data, error } = await query;

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

    const actorColumn = actor.kind === 'user' ? 'user_id' : 'guest_token';
    const actorValue = actor.kind === 'user' ? actor.profileId : actor.guestToken;

    if (!searchTerm) {
      const { error } = await admin
        .from('user_search_history')
        .delete()
        .eq(actorColumn, actorValue);
      if (error) {
        return internalServerError('search/history clear failed', error);
      }
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    const { error } = await admin
      .from('user_search_history')
      .delete()
      .eq(actorColumn, actorValue)
      .eq('term_key', termKey);

    if (error) {
      return internalServerError('search/history delete item failed', error);
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (e) {
    return internalServerError('search/history unexpected error', e);
  }
}
