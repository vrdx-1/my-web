import { NextResponse } from 'next/server';
import { invalidateFeedCache } from '@/lib/redis';

/**
 * POST /api/cache/invalidate-feed
 * ล้าง cache ฟีดทันที — เรียกเมื่อมีโพสต์ใหม่/แก้ไข/ขาย/Boost/แจ้งเตือน ฯลฯ
 * Request ถัดไปจะดึงข้อมูลจาก DB ใหม่
 */
export async function POST() {
  try {
    await invalidateFeedCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('API /api/cache/invalidate-feed POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
