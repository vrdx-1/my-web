#!/usr/bin/env node
/**
 * Generate PWA icons from source image (local file or Supabase URL).
 * Usage: node scripts/generate-pwa-icons.mjs [path-to-image.png]
 *        If no path given, uses default URL.
 * Writes: public/icons/icon-192x192.png, icon-512x512.png, apple-touch-icon.png
 */
import { createRequire } from "module";
import { mkdirSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const DEFAULT_ICON_URL =
  "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/new.png";
const OUT_DIR = join(__dirname, "..", "public", "icons");
const ROOT = join(__dirname, "..");

const SIZES = [
  { name: "icon-192x192.png", size: 192 },
  { name: "icon-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  const localPath = process.argv[2];
  let buffer;

  if (localPath) {
    const abs = resolve(ROOT, localPath);
    if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
    console.log("Using local image:", abs);
    const { readFileSync } = await import("fs");
    buffer = readFileSync(abs);
  } else {
    console.log("Fetching source image from URL...");
    const res = await fetch(DEFAULT_ICON_URL);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }

  mkdirSync(OUT_DIR, { recursive: true });

  for (const { name, size } of SIZES) {
    const outPath = join(OUT_DIR, name);
    await sharp(buffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Written ${name} (${size}x${size})`);
  }
  console.log("Done. PWA icons are in public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
