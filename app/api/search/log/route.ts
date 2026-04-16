import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

/**
 * POST /api/search/log
 * บันทึกการค้นหาลง search_logs (ทั้ง User และ Guest)
 * Body: { search_term: string, search_type: 'manual' | 'suggestion' | 'history', guest_token?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const search_term = typeof body.search_term === 'string' ? body.search_term.trim() : '';
    const search_type = body.search_type === 'manual' || body.search_type === 'suggestion' || body.search_type === 'history'
      ? body.search_type
      : 'manual';
    const guest_token = typeof body.guest_token === 'string' ? body.guest_token.trim() || null : null;

    if (search_term.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const resolvedProfile = await resolveServerActiveProfile(request);

    const row: { search_term: string; search_type: string; user_id?: string; guest_token?: string | null; display_text?: string } = {
      search_term,
      search_type,
      display_text: search_term,
    };
    if (resolvedProfile?.activeProfileId) {
      row.user_id = resolvedProfile.activeProfileId;
    } else if (guest_token) {
      row.guest_token = guest_token;
    }

    const { error } = await admin.from('search_logs').insert(row);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
