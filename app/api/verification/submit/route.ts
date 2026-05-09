import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processImageSmart } from '@/lib/smartImageProcessing';
import { resolveServerActiveProfile } from '@/utils/serverActiveProfile';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { UploadValidationError, validateAndReadImageFile } from '@/lib/uploadValidation';

export const runtime = 'nodejs';

const ALLOWED_TYPES = ['id_card', 'driver_license', 'passport'] as const;
const MAX_RAW_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const resolvedProfile = await resolveServerActiveProfile(req);
  const userId = resolvedProfile?.activeProfileId ?? null;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getRequestIp(req);
  const ipRateLimit = await checkRateLimit({
    namespace: 'verification:submit:ip',
    identifier: ip,
    limit: 10,
    windowSeconds: 10 * 60,
  });
  if (!ipRateLimit.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const userRateLimit = await checkRateLimit({
    namespace: 'verification:submit:user',
    identifier: userId,
    limit: 3,
    windowSeconds: 10 * 60,
  });
  if (!userRateLimit.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // Check if user already has a pending or approved request
  const { data: existingRequest } = await adminClient
    .from('verification_requests')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existingRequest) {
    if (existingRequest.status === 'approved') {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Verification request already pending' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const documentType = formData.get('document_type') as string;
  const documentFile = formData.get('document_photo') as File | null;
  const selfieFile = formData.get('selfie_photo') as File | null;

  if (!documentType || !ALLOWED_TYPES.includes(documentType as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  }
  if (!documentFile || !selfieFile) {
    return NextResponse.json({ error: 'Both document and selfie photos are required' }, { status: 400 });
  }

  // Process images through Sharp (converts HEIC/HEIF → WebP, compresses, auto-rotates)
  // This is the same pipeline used by create-post, so any format iPhone sends will work.
  let docResult: Awaited<ReturnType<typeof processImageSmart>>;
  let selfieResult: Awaited<ReturnType<typeof processImageSmart>>;
  try {
    const [docBuffer, selfieBuffer] = await Promise.all([
      validateAndReadImageFile(documentFile, {
        maxBytes: MAX_RAW_FILE_SIZE,
        fieldLabel: 'document',
      }),
      validateAndReadImageFile(selfieFile, {
        maxBytes: MAX_RAW_FILE_SIZE,
        fieldLabel: 'selfie',
      }),
    ]);
    [docResult, selfieResult] = await Promise.all([
      processImageSmart(docBuffer),
      processImageSmart(selfieBuffer),
    ]);
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('verification image processing failed', e);
    return NextResponse.json({ error: 'Image processing failed' }, { status: 400 });
  }

  const ts = Date.now();
  const documentPath = `verifications/${userId}/${ts}-document.${docResult.outputExtension}`;
  const selfiePath    = `verifications/${userId}/${ts}-selfie.${selfieResult.outputExtension}`;

  const [docUpload, selfieUpload] = await Promise.all([
    adminClient.storage.from('car-images').upload(documentPath, docResult.buffer, {
      contentType: docResult.outputMimeType,
      upsert: false,
    }),
    adminClient.storage.from('car-images').upload(selfiePath, selfieResult.buffer, {
      contentType: selfieResult.outputMimeType,
      upsert: false,
    }),
  ]);

  if (docUpload.error || selfieUpload.error) {
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 });
  }

  const { data: docUrlData } = adminClient.storage.from('car-images').getPublicUrl(documentPath);
  const { data: selfieUrlData } = adminClient.storage.from('car-images').getPublicUrl(selfiePath);

  const { error: insertError } = await adminClient
    .from('verification_requests')
    .insert({
      user_id: userId,
      document_type: documentType,
      document_url: docUrlData.publicUrl,
      selfie_url: selfieUrlData.publicUrl,
      status: 'pending',
    });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create verification request' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
