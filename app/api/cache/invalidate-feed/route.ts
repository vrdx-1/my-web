import { NextResponse } from 'next/server';
import { invalidateFeedCache } from '@/lib/redis';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

/**
 * POST /api/cache/invalidate-feed
 * ล้าง cache ฟีดทันที — เรียกเมื่อมีโพสต์ใหม่/แก้ไข/ขาย/Boost/แจ้งเตือน ฯลฯ
 * Request ถัดไปจะดึงข้อมูลจาก DB ใหม่
 */
export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'cache:invalidate-feed',
      identifier: ip,
      limit: 30,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    await invalidateFeedCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalServerError('cache/invalidate-feed POST failed', err);
  }
}
