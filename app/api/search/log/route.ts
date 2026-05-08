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

    let userId: string | null = null;

    const {
      data: { user: cookieUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (cookieUser?.id && !userError) {
      userId = cookieUser.id;
    }

    if (!userId) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (accessToken) {
        const {
          data: { user: headerUser },
        } = await supabase.auth.getUser(accessToken);
        if (headerUser?.id) {
          userId = headerUser.id;
        }
      }
    }
    
    // ถ้าผู้ใช้ login แล้ว ให้ตรวจสอบ role และ is_sub_account
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_sub_account, parent_admin_id')
        .eq('id', userId)
        .single();

      // ถ้าเป็น admin ให้ข้ามการบันทึก
      if (profile?.role === 'admin') {
        console.log(`[Search Log] Skipped: Admin user ${userId} searched for "${search_term}"`);
        return NextResponse.json({ ok: true });
      }

      // ถ้าเป็น sub account ของ admin ให้ข้ามการบันทึก
      if (profile?.is_sub_account === true && profile?.parent_admin_id) {
        console.log(`[Search Log] Skipped: Sub account user ${userId} searched for "${search_term}"`);
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
    console.log(`[Search Log] Recorded: "${search_term}" (${search_type})`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[Search Log Error]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
