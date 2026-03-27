import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

export type SmartImageStrategy = 'bypass-original' | 'preserve-detail' | 'optimize-size';
export type SmartImageBypassMode = 'none' | 'small-any-format' | 'small-webp-only';

export interface SmartImageProcessingOptions {
  smallImageMaxBytes?: number;
  minOriginalWidth?: number;
  largeImageMaxWidth?: number;
  preserveQuality?: number;
  optimizedQuality?: number;
  bypassMode?: SmartImageBypassMode;
}

export interface SmartImageMetadata {
  sizeBytes: number;
  width: number;
  height: number;
  format?: string;
}

export interface SmartImageProcessingResult {
  strategy: SmartImageStrategy;
  qualityUsed: number | null;
  outputMimeType: string;
  outputExtension: string;
  original: SmartImageMetadata;
  output: SmartImageMetadata;
  buffer: Buffer;
}

const DEFAULT_OPTIONS: Required<SmartImageProcessingOptions> = {
  smallImageMaxBytes: 300 * 1024,
  minOriginalWidth: 1600,
  largeImageMaxWidth: 1920,
  preserveQuality: 90,
  optimizedQuality: 78,
  bypassMode: 'small-webp-only',
};

function formatToMimeType(format?: string): string {
  if (!format) return 'application/octet-stream';
  if (format === 'jpg') return 'image/jpeg';
  return `image/${format}`;
}

function formatToExtension(format?: string): string {
  if (!format) return 'bin';
  return format === 'jpeg' ? 'jpg' : format;
}

/**
 * Smart image processing for uploads.
 *
 * Strategy:
 * - Bypass mode (optional): return original buffer without re-encoding
 * - Small or already compressed images: keep detail (WebP quality 90)
 * - Large/original images: resize to max width 1920 + WebP quality ~78
 */
export async function processImageSmart(
  input: Buffer,
  options: SmartImageProcessingOptions = {},
): Promise<SmartImageProcessingResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const originalMeta = await sharp(input).metadata();
  const originalWidth = originalMeta.width ?? 0;
  const originalHeight = originalMeta.height ?? 0;

  if (!originalWidth || !originalHeight) {
    throw new Error('Unable to read image width/height from uploaded file.');
  }

  const originalFormat = originalMeta.format;
  const isSmallForBypass =
    input.byteLength <= config.smallImageMaxBytes && originalWidth <= config.minOriginalWidth;
  const shouldBypassAnyFormat = config.bypassMode === 'small-any-format' && isSmallForBypass;
  const shouldBypassSmallWebp =
    config.bypassMode === 'small-webp-only' && isSmallForBypass && originalFormat === 'webp';

  if (shouldBypassAnyFormat || shouldBypassSmallWebp) {
    return {
      strategy: 'bypass-original',
      qualityUsed: null,
      outputMimeType: formatToMimeType(originalFormat),
      outputExtension: formatToExtension(originalFormat),
      original: {
        sizeBytes: input.byteLength,
        width: originalWidth,
        height: originalHeight,
        format: originalFormat,
      },
      output: {
        sizeBytes: input.byteLength,
        width: originalWidth,
        height: originalHeight,
        format: originalFormat,
      },
      buffer: input,
    };
  }

  const isSmallOrAlreadyCompressed =
    input.byteLength <= config.smallImageMaxBytes || originalWidth <= config.minOriginalWidth;

  const strategy: SmartImageStrategy = isSmallOrAlreadyCompressed
    ? 'preserve-detail'
    : 'optimize-size';

  const quality = isSmallOrAlreadyCompressed ? config.preserveQuality : config.optimizedQuality;

  let pipeline = sharp(input).rotate();

  if (!isSmallOrAlreadyCompressed) {
    pipeline = pipeline.resize({
      width: config.largeImageMaxWidth,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const outputBuffer = await pipeline
    .webp({
      quality,
      effort: 4,
    })
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    strategy,
    qualityUsed: quality,
    outputMimeType: 'image/webp',
    outputExtension: 'webp',
    original: {
      sizeBytes: input.byteLength,
      width: originalWidth,
      height: originalHeight,
      format: originalMeta.format,
    },
    output: {
      sizeBytes: outputBuffer.byteLength,
      width: outputMeta.width ?? originalWidth,
      height: outputMeta.height ?? originalHeight,
      format: outputMeta.format,
    },
    buffer: outputBuffer,
  };
}

export async function processImageSmartToFile(
  input: Buffer,
  outputPath: string,
  options: SmartImageProcessingOptions = {},
): Promise<Omit<SmartImageProcessingResult, 'buffer'> & { outputPath: string }> {
  const result = await processImageSmart(input, options);
  await writeFile(outputPath, result.buffer);

  return {
    strategy: result.strategy,
    qualityUsed: result.qualityUsed,
    outputMimeType: result.outputMimeType,
    outputExtension: result.outputExtension,
    original: result.original,
    output: result.output,
    outputPath,
  };
}
