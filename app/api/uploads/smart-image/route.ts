import { NextResponse } from 'next/server';
import { processImageSmart } from '@/lib/smartImageProcessing';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { UploadValidationError, validateAndReadImageFile } from '@/lib/uploadValidation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'upload:smart-image',
      identifier: ip,
      limit: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, rateLimit.reset - Math.floor(Date.now() / 1000))),
          },
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field in form-data.' }, { status: 400 });
    }

    const inputBuffer = await validateAndReadImageFile(file, {
      maxBytes: 15 * 1024 * 1024,
      fieldLabel: 'file',
    });
    const result = await processImageSmart(inputBuffer);
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.outputMimeType,
        'Content-Disposition': `inline; filename="${baseName}.${result.outputExtension}"`,
        'X-Image-Strategy': result.strategy,
        'X-Original-Size-Bytes': String(result.original.sizeBytes),
        'X-Output-Size-Bytes': String(result.output.sizeBytes),
        'X-Original-Width': String(result.original.width),
        'X-Output-Width': String(result.output.width),
        'X-Quality-Used': result.qualityUsed === null ? 'bypass' : String(result.qualityUsed),
      },
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('smart-image upload failed', error);
    return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
  }
}
