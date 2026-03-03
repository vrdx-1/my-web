import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST: สร้างแถว session ใหม่ใน user_sessions (ใช้ service_role เลยไม่ติด RLS)
 * เรียกจาก VisitorTracker แทนการ insert จาก client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const visitor_id = body?.visitor_id;
    const user_id = body?.user_id ?? null;
    if (!visitor_id || typeof visitor_id !== 'string' || visitor_id.trim() === '') {
      return NextResponse.json({ error: 'visitor_id required' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY ไม่ได้ตั้งค่าใน environment (เพิ่มใน Vercel/hosting ให้ตรงกับ localhost)' },
        { status: 503 }
      );
    }
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL ไม่ได้ตั้งค่าใน environment' },
        { status: 503 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const started_at = new Date().toISOString();
    const { data: sessionRow, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user_id || null,
        visitor_id: visitor_id.trim(),
        started_at,
      })
      .select('id')
      .single();

    if (error) {
      console.error('session-start insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!sessionRow?.id) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: sessionRow.id, started_at });
  } catch (e) {
    console.error('session-start error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
