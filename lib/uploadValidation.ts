import sharp from 'sharp';

export class UploadValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'UploadValidationError';
    this.status = status;
  }
}

const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const DEFAULT_ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

export async function validateAndReadImageFile(
  file: File,
  options?: {
    maxBytes?: number;
    fieldLabel?: string;
    allowedMimeTypes?: Set<string>;
    allowedFormats?: Set<string>;
  },
): Promise<Buffer> {
  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024;
  const fieldLabel = options?.fieldLabel ?? 'file';
  const allowedMimeTypes = options?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const allowedFormats = options?.allowedFormats ?? DEFAULT_ALLOWED_FORMATS;

  if (file.size <= 0) {
    throw new UploadValidationError(`Invalid ${fieldLabel}: file is empty`);
  }

  if (file.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024));
    throw new UploadValidationError(`Invalid ${fieldLabel}: file too large (max ${maxMb}MB)`);
  }

  const mimeType = (file.type || '').toLowerCase().trim();
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new UploadValidationError(`Invalid ${fieldLabel}: unsupported file type`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const metadata = await sharp(buffer).metadata();
  const format = metadata.format?.toLowerCase();
  if (!format || !allowedFormats.has(format)) {
    throw new UploadValidationError(`Invalid ${fieldLabel}: unsupported image format`);
  }

  if (!metadata.width || !metadata.height) {
    throw new UploadValidationError(`Invalid ${fieldLabel}: missing image dimensions`);
  }

  return buffer;
}
