#!/usr/bin/env node
/**
 * ตรวจสอบทุกรุ่นว่า:
 * - รุ่นที่มี 3 ภาษา (ไทย/ลาว/อังกฤษ) → คำค้นที่ใช้กับ caption ครบทั้ง 3 ภาษาหรือไม่
 * - รุ่นที่มีภาษาเดียว (อังกฤษ) → คำค้นเฉพาะรุ่นนั้นหรือไม่
 * ใช้ชุดคำเดียวกับ API: modelName, modelNameTh, modelNameLo, searchNames
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BRANDS_DIR = join(DATA_DIR, 'brands');

const THAI_RE = /[\u0E00-\u0E7F]/;
const LAO_RE = /[\u0E80-\u0EFF]/;
const LATIN_RE = /[a-zA-Z]/;

function hasScript(text, re) {
  return re.test(String(text ?? ''));
}

function getModelSearchTerms(model) {
  const terms = new Set();
  const add = (v) => {
    const s = String(v ?? '').trim();
    if (s) terms.add(s);
  };
  add(model.modelName);
  add(model.modelNameTh);
  add(model.modelNameLo);
  for (const s of model.searchNames ?? []) add(s);
  return Array.from(terms);
}

function classifyModel(brandId, model) {
  const terms = getModelSearchTerms(model);
  let hasThai = false;
  let hasLao = false;
  let hasEn = false;
  for (const t of terms) {
    if (hasScript(t, THAI_RE)) hasThai = true;
    if (hasScript(t, LAO_RE)) hasLao = true;
    if (hasScript(t, LATIN_RE)) hasEn = true;
  }
  const lang = hasThai && hasLao && hasEn ? '3lang' : hasEn ? 'en_only' : hasThai || hasLao ? 'th_lo_only' : 'none';
  return { terms, hasThai, hasLao, hasEn, lang };
}

import { readdirSync } from 'fs';
const files = readdirSync(BRANDS_DIR).filter((f) => f.endsWith('.json'));

const results = { threeLang: [], enOnly: [], thLoOnly: [], none: [], byBrand: {} };

for (const file of files) {
  const path = join(BRANDS_DIR, file);
  const raw = readFileSync(path, 'utf8');
  let brand;
  try {
    brand = JSON.parse(raw);
  } catch (e) {
    console.error('Parse error:', file, e.message);
    continue;
  }
  const brandId = brand.brandId || file.replace('.json', '');
  results.byBrand[brandId] = { threeLang: [], enOnly: [], other: [] };

  for (const model of brand.models ?? []) {
    const { terms, hasThai, hasLao, hasEn, lang } = classifyModel(brandId, model);
    const name = model.modelName || model.modelId || '?';
    const entry = { brandId, modelId: model.modelId, modelName: name, terms, hasThai, hasLao, hasEn };

    if (lang === '3lang') {
      results.threeLang.push(entry);
      results.byBrand[brandId].threeLang.push(name);
    } else if (lang === 'en_only') {
      results.enOnly.push(entry);
      results.byBrand[brandId].enOnly.push(name);
    } else if (lang === 'th_lo_only') {
      results.thLoOnly.push(entry);
      results.byBrand[brandId].other.push(name);
    } else {
      results.none.push(entry);
      results.byBrand[brandId].other.push(name);
    }
  }
}

// Report
console.log('=== สรุปการค้นหา caption ตามรุ่น (ใช้ชุดคำเดียวกับ API) ===\n');
console.log('รุ่นที่มี 3 ภาษา (ไทย+ลาว+อังกฤษ) → โพสที่ caption มีคำใดคำหนึ่งในชุดคำจะถูกแสดง (ครบ 3 ภาษา):');
console.log('จำนวนรุ่น:', results.threeLang.length);
console.log('ตัวอย่าง (5 รุ่นแรก):');
results.threeLang.slice(0, 5).forEach((m) => {
  console.log('  -', m.brandId + '/' + m.modelId, '| terms:', m.terms.slice(0, 6).join(', ') + (m.terms.length > 6 ? '...' : ''));
});
console.log('');

console.log('รุ่นที่มีเฉพาะภาษาอังกฤษ (ไม่มีข้อความไทย/ลาวในข้อมูล) → ค้นเฉพาะคำในชุดนั้น = เฉพาะรุ่นนั้น:');
console.log('จำนวนรุ่น:', results.enOnly.length);
console.log('ตัวอย่าง (5 รุ่นแรก):');
results.enOnly.slice(0, 5).forEach((m) => {
  console.log('  -', m.brandId + '/' + m.modelId, '| terms:', m.terms.join(', '));
});
console.log('');

if (results.thLoOnly.length) {
  console.log('รุ่นที่มีแค่ไทยหรือลาว (ไม่มีอังกฤษในชุดคำ):', results.thLoOnly.length);
  results.thLoOnly.slice(0, 3).forEach((m) => console.log('  -', m.brandId + '/' + m.modelId));
  console.log('');
}
if (results.none.length) {
  console.log('รุ่นที่ไม่มีคำค้น (ไม่มีตัวอักษรไทย/ลาว/อังกฤษใน terms):', results.none.length);
  results.none.slice(0, 3).forEach((m) => console.log('  -', m.brandId + '/' + m.modelId, '| terms:', m.terms));
  console.log('');
}

console.log('=== สรุปตามยี่ห้อ (จำนวนรุ่น) ===');
const brands = Object.keys(results.byBrand).sort();
for (const b of brands) {
  const v = results.byBrand[b];
  const t3 = v.threeLang.length;
  const e = v.enOnly.length;
  const o = v.other.length;
  if (t3 + e + o === 0) continue;
  console.log(b + ':', '3 ภาษา=' + t3, 'อังกฤษเดียว=' + e, (o ? 'อื่น=' + o : ''));
}

console.log('\n=== สรุปผลการตรวจ ===');
console.log('1) รุ่นที่ข้อมูลมี 3 ภาษา (modelName + modelNameTh + modelNameLo + searchNames มีทั้งไทย/ลาว/อังกฤษ):');
console.log('   → API ใช้ชุดคำนี้ใน expandWithoutBrandAliases → caption ที่มีคำใดคำหนึ่งในชุดจะถูกแสดง (ครบ 3 ภาษา)');
console.log('2) รุ่นที่ข้อมูลมีเฉพาะอังกฤษ:');
console.log('   → API ใช้เฉพาะคำในชุดนั้น → ค้น caption เฉพาะรุ่นนั้นและเฉพาะภาษาที่มีในข้อมูล');
