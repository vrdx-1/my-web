import fs from 'fs';
import path from 'path';

// Resolve project root (one level up from scripts/)
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, '..');

const carsPath = path.join(rootDir, 'data', 'cars.json');
const suvPath = path.join(rootDir, 'data', 'category-models', 'suv.json');

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveJson(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf8');
}

// 1) โหลดข้อมูลแบรนด์ + รุ่นทั้งหมด
const carsData = loadJson(carsPath);
const brands = carsData.brands ?? [];

// 2) สร้าง mapping: alias สั้น (1–4 ตัวอักษร) ที่อยู่ในหมวด suv -> ชื่อยี่ห้อภาษาอังกฤษ
const shortAliasToBrand = new Map();

for (const brand of brands) {
  const brandNameEn = String(brand.brandName ?? '').trim();
  if (!brandNameEn) continue;

  const models = brand.models ?? [];
  for (const model of models) {
    const categoryIds = model.categoryIds ?? [];
    if (!categoryIds.includes('suv')) continue;

    const aliases = [
      model.modelName,
      model.modelNameTh,
      model.modelNameLo,
      ...(model.searchNames ?? []),
    ]
      .map((a) => String(a ?? '').trim())
      .filter(Boolean);

    for (const alias of aliases) {
      // เฉพาะชื่อที่ยาว 1–4 ตัวอักษรเท่านั้น
      if (alias.length >= 1 && alias.length <= 4) {
        // ถ้ามีหลายยี่ห้อใช้ alias เดียวกัน ให้เก็บตัวแรกที่เจอ (ลดความซับซ้อน)
        if (!shortAliasToBrand.has(alias)) {
          shortAliasToBrand.set(alias, brandNameEn);
        }
      }
    }
  }
}

// 3) โหลด suv.json แล้วแทนค่าชื่อรุ่นสั้นเป็น "BrandEn alias"
const suvData = loadJson(suvPath);
const modelNames = suvData.modelNames ?? [];

const updatedModelNames = modelNames.map((name) => {
  const s = String(name ?? '');
  if (s.length >= 1 && s.length <= 4) {
    const brandNameEn = shortAliasToBrand.get(s);
    if (brandNameEn) {
      return `${brandNameEn} ${s}`;
    }
  }
  return s;
});

// กันชื่อซ้ำเล็กน้อย
suvData.modelNames = Array.from(new Set(updatedModelNames));

saveJson(suvPath, suvData);

console.log('Updated suv.json with brand prefixes for short SUV model names (1–4 chars).');

