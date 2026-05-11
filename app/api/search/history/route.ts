import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { internalServerError } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

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

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveServerActiveProfile(request);
    if (!resolved?.activeProfileId) {
      return NextResponse.json({ items: [] });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const limitRaw = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 20;

    const { data, error } = await admin
      .from('user_search_history')
      .select('search_term, display_text, last_search_type, search_count, last_searched_at')
      .eq('user_id', resolved.activeProfileId)
      .order('last_searched_at', { ascending: false })
      .limit(limit);

    if (error) {
      return internalServerError('search/history get failed', error);
    }

    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return internalServerError('search/history unexpected error', e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const resolved = await resolveServerActiveProfile(request);
    if (!resolved?.activeProfileId) {
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const rawSearchTerm = typeof body?.search_term === 'string' ? body.search_term : '';
    const { searchTerm, termKey } = normalizeSearchTerm(rawSearchTerm);

    if (!searchTerm) {
      const { error } = await admin
        .from('user_search_history')
        .delete()
        .eq('user_id', resolved.activeProfileId);
      if (error) {
        return internalServerError('search/history clear failed', error);
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from('user_search_history')
      .delete()
      .eq('user_id', resolved.activeProfileId)
      .eq('term_key', termKey);

    if (error) {
      return internalServerError('search/history delete item failed', error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalServerError('search/history unexpected error', e);
  }
}
