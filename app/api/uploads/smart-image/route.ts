import { NextResponse } from 'next/server';
import { processImageSmart } from '@/lib/smartImageProcessing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field in form-data.' }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
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
    const message = error instanceof Error ? error.message : 'Image processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
