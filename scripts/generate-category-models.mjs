#!/usr/bin/env node
/**
 * สร้างไฟล์แยกตามประเภท (category) จาก data/brands
 * อ่าน categories จาก data/categories.json และรุ่นจาก data/brands/*.json
 * เขียน data/category-models/{categoryId}.json แต่ละไฟล์มี modelNames: string[]
 *
 * Usage: node scripts/generate-category-models.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const brandsDir = join(dataDir, 'brands');
const outDir = join(dataDir, 'category-models');

function normalizeForFallback(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// โหลด categories เพื่อดึง category ids
const categoriesPath = join(dataDir, 'categories.json');
if (!existsSync(categoriesPath)) {
  console.error('data/categories.json not found.');
  process.exit(1);
}
const categoriesData = JSON.parse(readFileSync(categoriesPath, 'utf-8'));
const categoryIds = [];
for (const group of categoriesData.categoryGroups ?? []) {
  for (const cat of group.categories ?? []) {
    const id = cat?.id ? String(cat.id).trim() : null;
    if (id) categoryIds.push(id);
  }
}

const brandFiles = readdirSync(brandsDir).filter((f) => f.endsWith('.json'));

// สำหรับแต่ละ category สร้าง set ของชื่อรุ่น
const categoryToModelNames = new Map();
for (const cid of categoryIds) {
  categoryToModelNames.set(cid, new Set());
}

for (const f of brandFiles) {
  const path = join(brandsDir, f);
  const brand = JSON.parse(readFileSync(path, 'utf-8'));
  const brandEn = brand?.brandName?.trim() ?? '';
  const brandTh = brand?.brandNameTh?.trim() ?? '';
  const brandLo = brand?.brandNameLo?.trim() ?? '';

  for (const model of brand?.models ?? []) {
    const modelCats = model?.categoryIds ?? [];
    const modelEn = model?.modelName?.trim() ?? '';
    const modelTh = model?.modelNameTh?.trim() ?? '';
    const modelLo = model?.modelNameLo?.trim() ?? '';

    const terms = [
      modelEn,
      modelTh,
      modelLo,
      ...(model?.searchNames ?? []).map(String),
    ].filter(Boolean).map((s) => String(s).trim()).filter(Boolean);

    // ใส่แบรนด์นำหน้าทุกรูปแบบของรุ่น (model/searchNames) ในทั้ง 3 ภาษาแบรนด์
    // เช่น revo -> Toyota revo / โตโยต้า revo / ໂຕໂຍຕ້າ revo
    const brandPrefixedTerms = [];
    for (const t of terms) {
      if (brandEn) brandPrefixedTerms.push(`${brandEn} ${t}`);
      if (brandTh) brandPrefixedTerms.push(`${brandTh} ${t}`);
      if (brandLo) brandPrefixedTerms.push(`${brandLo} ${t}`);
    }

    for (const cid of categoryIds) {
      if (!modelCats.includes(cid)) continue;
      // เพิ่มเฉพาะคำที่มีแบรนด์นำหน้า
      for (const t of brandPrefixedTerms) {
        categoryToModelNames.get(cid).add(t);
      }
    }
  }
}

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

for (const cid of categoryIds) {
  const names = Array.from(categoryToModelNames.get(cid)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const outPath = join(outDir, `${cid}.json`);
  writeFileSync(outPath, JSON.stringify({ categoryId: cid, modelNames: names }, null, 2), 'utf-8');
  console.log(`Wrote ${outPath} (${names.length} names)`);
}

console.log('Done.');
