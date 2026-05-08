import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/search/log
 * บันทึกการค้นหาลง search_logs แบบ anonymous
 * ข้ามการบันทึกหากเป็นบัญชี admin หรือ sub account ของ admin
 * Body: { search_term: string, search_type: 'manual' | 'suggestion' | 'history' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const search_term = typeof body.search_term === 'string' ? body.search_term.trim() : '';
    const search_type = body.search_type === 'manual' || body.search_type === 'suggestion' || body.search_type === 'history'
      ? body.search_type
      : 'manual';

    if (search_term.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // ข้ามการบันทึกจาก localhost (development environment)
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return NextResponse.json({ ok: true });
    }

    // ตรวจสอบว่าผู้ใช้เป็น admin หรือ sub account ของ admin หรือไม่
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

    const { data: { session } } = await supabase.auth.getSession();
    
    // ถ้าผู้ใช้ login แล้ว ให้ตรวจสอบ role และ is_sub_account
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_sub_account')
        .eq('id', session.user.id)
        .single();

      // ถ้าเป็น admin หรือ sub account ของ admin ให้ข้ามการบันทึก
      if (profile?.role === 'admin' || profile?.is_sub_account === true) {
        return NextResponse.json({ ok: true });
      }
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

    const row: { search_term: string; search_type: string; display_text?: string } = {
      search_term,
      search_type,
      display_text: search_term,
    };

    const { error } = await admin.from('search_logs').insert(row);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
