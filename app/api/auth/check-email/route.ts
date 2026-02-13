import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ตรวจสอบว่าอีเมลนี้มีบัญชีในระบบแล้วหรือไม่ (ใช้ในหน้าสร้างบัญชีใหม่ เพื่อไม่ส่ง OTP ให้ผู้ใช้เก่า)
 * ต้องมี SUPABASE_SERVICE_ROLE_KEY ใน .env.local
 */
export async function POST(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
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
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
  const emailLower = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const users = data?.users ?? [];
    const found = users.some((u) => (u.email ?? '').toLowerCase() === emailLower);
    if (found) {
      return NextResponse.json({ exists: true });
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }
  return NextResponse.json({ exists: false });
}
