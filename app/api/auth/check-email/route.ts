import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';

/**
 * Endpoint นี้ตั้งใจตอบแบบ generic เพื่อลดความเสี่ยง email enumeration.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'auth:check-email',
    identifier: `${ip}:${email.toLowerCase()}`,
    limit: 8,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, rateLimit.reset - Math.floor(Date.now() / 1000))),
        },
      }
    );
  }

  // Always return a neutral response to avoid exposing whether an email is registered.
  return NextResponse.json({ exists: false });
}
