import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST: ผูก user_id กับ session (ใช้ service_role ไม่ติด RLS)
 * เรียกจาก VisitorTracker ตอนรู้ว่า user login แล้ว แต่ session ถูกสร้างตอนยังไม่มี user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = body?.sessionId;
    const user_id = body?.user_id;
    if (!sessionId || typeof sessionId !== 'string' || !user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'sessionId and user_id required' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase
      .from('user_sessions')
      .update({ user_id })
      .eq('id', sessionId)
      .is('user_id', null);

    if (error) {
      console.error('session-link-user error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('session-link-user error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
