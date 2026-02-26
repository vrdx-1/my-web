import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET: ปิด session ค้าง (ended_at IS NULL) ที่ last_seen_at หรือ started_at เก่ากว่า N นาที
 * ตั้งค่า ended_at + duration_seconds จากฟังก์ชัน close_stale_user_sessions
 * เรียกจาก Vercel Cron หรือ external cron โดยส่ง header ลับ
 */
const STALE_MINUTES = 5;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const querySecret = request.nextUrl.searchParams.get('secret');
  const ok = secret && (bearer === secret || querySecret === secret);
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { data: updatedCount, error } = await supabase.rpc('close_stale_user_sessions', {
      stale_minutes: STALE_MINUTES,
    });

    if (error) {
      console.error('close-stale-sessions rpc error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, closed: updatedCount ?? 0 });
  } catch (e) {
    console.error('close-stale-sessions error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
