import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ALLOWED_TYPES = ['id_card', 'driver_license', 'passport'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Image extensions recognised as photos (includes iPhone HEIC/HEIF)
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif', 'avif'];

function getFileExtension(fileName: string) {
  return (fileName.split('.').pop() ?? '').toLowerCase();
}

// Very lenient check: accept anything that looks like a photo.
// iPhone PWA can send empty MIME, "application/octet-stream", or "image/heic" for the same file.
function isAllowedImage(file: File): boolean {
  const mime = (file.type ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (!mime || mime === 'application/octet-stream') return true; // iOS edge case
  return IMAGE_EXTS.includes(getFileExtension(file.name));
}

function getContentType(file: File): string {
  const mime = (file.type ?? '').toLowerCase();
  if (mime.startsWith('image/')) return mime;
  const ext = getFileExtension(file.name);
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'avif') return 'image/avif';
  return 'image/jpeg'; // safe default for iOS photos
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  let userId = session?.user?.id ?? null;

  // Fallback for PWA/browser contexts where auth cookies are unavailable.
  if (!userId) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const { data: userData } = await adminClient.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Validate file sizes (type check is intentionally lenient to support all iPhone formats)
  for (const [label, file] of [['document', documentFile], ['selfie', selfieFile]] as [string, File][]) {
    if (!isAllowedImage(file)) {
      return NextResponse.json({ error: `ປະເພດໄຟລ໌ ${label} ບໍ່ຖືກຕ້ອງ ກະລຸນາໃຊ້ຮູບພາບ` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `ຮູບ ${label} ມີຂະໜາດໃຫຍ່ເກີນໄປ (ສູງສຸດ 10MB)` }, { status: 400 });
    }
  }

  const ts = Date.now();
  const docExt = getFileExtension(documentFile.name) || 'jpg';
  const selfieExt = getFileExtension(selfieFile.name) || 'jpg';
  const documentPath = `verifications/${userId}/${ts}-document.${docExt}`;
  const selfiePath = `verifications/${userId}/${ts}-selfie.${selfieExt}`;

  const docBuffer = Buffer.from(await documentFile.arrayBuffer());
  const selfieBuffer = Buffer.from(await selfieFile.arrayBuffer());

  const [docUpload, selfieUpload] = await Promise.all([
    adminClient.storage.from('car-images').upload(documentPath, docBuffer, {
      contentType: getContentType(documentFile),
      upsert: false,
    }),
    adminClient.storage.from('car-images').upload(selfiePath, selfieBuffer, {
      contentType: getContentType(selfieFile),
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
