import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = join(__dirname, '../public/share-icon.png');
const outputPath = join(__dirname, '../public/share-icon.png');

const img = await sharp(inputPath);
const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const luminance = (r + g + b) / 3;
  if (luminance < 30) {
    data[i + 3] = 0;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outputPath);

console.log('Done: black pixels set to transparent in share-icon.png');
