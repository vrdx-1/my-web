import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** ตั้งค่า last_seen เป็นเวลาที่ผ่านมาแล้ว (เกินเกณฑ์ออนไลน์) เพื่อให้สถานะแสดงออฟไลน์ทันที */
const OFFLINE_LAST_SEEN_SECONDS_AGO = 120;

/**
 * POST /api/profiles/offline
 * เรียกเมื่อผู้ใช้ปิดแอป/ซ่อนแท็บ เพื่อให้อีกเครื่องเห็นสถานะออฟไลน์ตามจริง
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ ok: true });
    }

    const pastTime = new Date(Date.now() - OFFLINE_LAST_SEEN_SECONDS_AGO * 1000).toISOString();
    await supabase
      .from('profiles')
      .update({ last_seen: pastTime })
      .eq('id', user.id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('API /api/profiles/offline POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
