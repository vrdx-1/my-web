import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST: บันทึก session end (ended_at + duration_seconds)
 * เรียกจาก VisitorTracker ตอนปิดแท็บ/ออกจากหน้า (keepalive)
 * ใช้ service_role เพื่ออัปเดตได้โดยไม่ต้อง auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
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
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('ended_at', null);

    if (error) {
      console.error('session-end update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // อัปเดต duration_seconds ด้วย raw SQL หรือใช้ RPC — Supabase client ไม่ support "set column = expression"
    // ดังนั้นเราอัปเดตสองครั้ง: ครั้งแรก set ended_at, ครั้งสอง set duration_seconds จากความต่าง
    const { data: row } = await supabase
      .from('user_sessions')
      .select('started_at, ended_at')
      .eq('id', sessionId)
      .single();

    if (row?.ended_at && row?.started_at) {
      const started = new Date(row.started_at).getTime();
      const ended = new Date(row.ended_at).getTime();
      const duration_seconds = Math.round((ended - started) / 1000);
      await supabase
        .from('user_sessions')
        .update({ duration_seconds })
        .eq('id', sessionId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('session-end error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
