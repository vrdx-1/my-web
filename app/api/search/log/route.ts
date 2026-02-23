import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Can be ignored if middleware is refreshing sessions
            }
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const row: { search_term: string; search_type: string; user_id?: string; guest_token?: string | null; display_text?: string } = {
      search_term,
      search_type,
      display_text: search_term,
    };
    if (user?.id) {
      row.user_id = user.id;
    } else if (guest_token) {
      row.guest_token = guest_token;
    }

    const { error } = await supabase.from('search_logs').insert(row);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
