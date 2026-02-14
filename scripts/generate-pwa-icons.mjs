#!/usr/bin/env node
/**
 * Generate PWA icons from source URL (Supabase PNG).
 * Writes: public/icons/icon-192x192.png, icon-512x512.png, apple-touch-icon.png
 */
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ICON_URL =
  "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/PNG.png";
const OUT_DIR = join(__dirname, "..", "public", "icons");

const SIZES = [
  { name: "icon-192x192.png", size: 192 },
  { name: "icon-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  console.log("Fetching source image...");
  const res = await fetch(ICON_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

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
