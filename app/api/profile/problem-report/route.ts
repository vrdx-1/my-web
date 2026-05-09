import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { UploadValidationError, validateAndReadImageFile } from '@/lib/uploadValidation';

const BUCKET_NAME = 'report-images';

export async function POST(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'profile:problem-report',
    identifier: ip,
    limit: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return tooManyRequests(rateLimit.reset);
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

  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const imageUrls: string[] = [];
  const files = formData.getAll('images').filter((item): item is File => item instanceof File);

  if (files.length > 4) {
    return NextResponse.json({ error: 'Too many images (max 4)' }, { status: 400 });
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let buffer: Buffer;
    try {
      buffer = await validateAndReadImageFile(file, {
        maxBytes: 10 * 1024 * 1024,
        fieldLabel: `image_${index + 1}`,
      });
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return internalServerError('profile/problem-report validate image failed', error);
    }

    const ext = file.type === 'image/jpeg' || file.type === 'image/jpg' ? 'jpg' : 'webp';
    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${resolvedProfile.activeProfileId}/${fileName}`;
    const { error: uploadError } = await admin.storage.from(BUCKET_NAME).upload(path, buffer, {
      contentType: file.type || 'image/webp',
      upsert: false,
    });
    if (uploadError) {
      return internalServerError('profile/problem-report upload failed', uploadError);
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
    return internalServerError('profile/problem-report insert failed', error);
  }

  return NextResponse.json({ ok: true });
}