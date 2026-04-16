import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';

const BUCKET_NAME = 'report-images';

export async function POST(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const resolvedProfile = await resolveServerActiveProfile(request);
  if (!resolvedProfile?.activeProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const message = typeof formData.get('message') === 'string' ? String(formData.get('message')).trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const imageUrls: string[] = [];
  const files = formData.getAll('images').filter((item): item is File => item instanceof File);

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const ext = file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${resolvedProfile.activeProfileId}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(BUCKET_NAME).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const { data } = admin.storage.from(BUCKET_NAME).getPublicUrl(path);
    imageUrls.push(data.publicUrl);
  }

  const { error } = await admin.from('user_problem_reports').insert({
    user_id: resolvedProfile.activeProfileId,
    message,
    image_urls: imageUrls.length > 0 ? imageUrls : null,
    status: 'pending',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}