import { NextRequest, NextResponse } from 'next/server';
import { getCarDictionarySuggestions } from '@/utils/postUtils';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

/**
 * GET /api/search/suggestions?q=...&limit=...
 * คืนรายการคำแนะนำจากพจนานุกรมรถ (โหลดฝั่ง server เท่านั้น — หน้า search ไม่ต้องโหลดข้อมูลรถทั้งหมด)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'search:suggestions',
      identifier: ip,
      limit: 120,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') ?? '';
    const limit = Math.min(30, Math.max(5, parseInt(searchParams.get('limit') ?? '15', 10) || 15));
    const prefix = (typeof q === 'string' ? q : '').trim();
    if (prefix.length === 0) {
      return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }
    const items = getCarDictionarySuggestions(prefix, limit);
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (err: unknown) {
    return internalServerError('search/suggestions GET failed', err);
  }
}
