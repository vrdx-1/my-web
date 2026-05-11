import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

type SearchActorRole = 'guest' | 'user' | 'admin' | 'sub_admin';

function normalizeSearchTerm(input: string): { searchTerm: string; termKey: string } {
  const searchTerm = input.trim().slice(0, 200);
  const termKey = searchTerm.toLocaleLowerCase();
  return { searchTerm, termKey };
}

/**
 * POST /api/search/log
 * บันทึกการค้นหาทุก actor ลง search_logs (guest / user / admin / sub_admin)
 * และอัปเดตประวัติการค้นหารายบัญชีใน user_search_history
 * Body: { search_term: string, search_type: 'manual' | 'suggestion' | 'history', guest_token?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchTerm: search_term, termKey } = normalizeSearchTerm(typeof body.search_term === 'string' ? body.search_term : '');
    const search_type = body.search_type === 'manual' || body.search_type === 'suggestion' || body.search_type === 'history'
      ? body.search_type
      : 'manual';
    const guest_token_raw = typeof body.guest_token === 'string' ? body.guest_token.trim() : '';
    const guest_token = guest_token_raw ? guest_token_raw.slice(0, 200) : null;

    if (search_term.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // ข้ามการบันทึกจาก localhost (development environment)
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return NextResponse.json({ ok: true });
    }

    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'search:log',
      identifier: ip,
      limit: 60,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const resolvedProfile = await resolveServerActiveProfile(request);
    const activeProfileId = resolvedProfile?.activeProfileId ?? null;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    let actorRole: SearchActorRole = activeProfileId ? 'user' : 'guest';
    if (activeProfileId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, is_sub_account, parent_admin_id')
        .eq('id', activeProfileId)
        .maybeSingle();

      if (profile?.is_sub_account && profile?.parent_admin_id) {
        actorRole = 'sub_admin';
      } else if (profile?.role === 'admin') {
        actorRole = 'admin';
      }
    }

    const row: {
      search_term: string;
      search_type: string;
      display_text?: string;
      user_id: string | null;
      guest_token: string | null;
      actor_role: SearchActorRole;
    } = {
      search_term,
      search_type,
      display_text: search_term,
      user_id: activeProfileId,
      guest_token: activeProfileId ? null : guest_token,
      actor_role: actorRole,
    };

    const { error } = await admin.from('search_logs').insert(row);

    if (error) {
      return internalServerError('search/log insert failed', error);
    }

    if (activeProfileId) {
      const { data: existingHistory } = await admin
        .from('user_search_history')
        .select('id, search_count')
        .eq('user_id', activeProfileId)
        .eq('term_key', termKey)
        .maybeSingle();

      if (existingHistory?.id) {
        const nextCount = Number(existingHistory.search_count || 0) + 1;
        const { error: updateHistoryError } = await admin
          .from('user_search_history')
          .update({
            search_term,
            display_text: search_term,
            last_search_type: search_type,
            search_count: nextCount,
            last_searched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingHistory.id);

        if (updateHistoryError) {
          return internalServerError('search/log history update failed', updateHistoryError);
        }
      } else {
        const { error: insertHistoryError } = await admin
          .from('user_search_history')
          .insert({
            user_id: activeProfileId,
            term_key: termKey,
            search_term,
            display_text: search_term,
            last_search_type: search_type,
            search_count: 1,
            last_searched_at: new Date().toISOString(),
          });

        if (insertHistoryError) {
          return internalServerError('search/log history insert failed', insertHistoryError);
        }
      }
    }

    console.log(`[Search Log] Recorded: "${search_term}" (${search_type}) actor=${actorRole}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalServerError('search/log unexpected error', e);
  }
}
