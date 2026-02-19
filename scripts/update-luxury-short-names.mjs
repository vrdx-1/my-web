import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, '..');

const carsPath = path.join(rootDir, 'data', 'cars.json');
const luxuryPath = path.join(rootDir, 'data', 'category-models', 'luxury.json');

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveJson(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf8');
}

// Normalize for lookup: lowercase, collapse spaces and dashes
function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\-]+/g, '')
    .trim();
}

// ชื่อเป็นตัวเลขล้วน หรือความยาว 1, 2, 3 ตัวอักษร (นับหลัง trim)
function shouldPrefix(name) {
  const s = String(name ?? '').trim();
  if (!s) return false;
  const len = s.length;
  const isAllDigits = /^\d+$/.test(s);
  return isAllDigits || len === 1 || len === 2 || len === 3;
}

const carsData = loadJson(carsPath);
const brands = carsData.brands ?? [];

// Map: normalized alias -> English brand name (lowercase) เฉพาะรุ่นที่อยู่ใน luxury
const normToBrandEn = new Map();

for (const brand of brands) {
  const brandNameEn = String(brand.brandName ?? '').trim();
  if (!brandNameEn) continue;
  const brandEnLower = brandNameEn.toLowerCase();

  const models = brand.models ?? [];
  for (const model of models) {
    const categoryIds = model.categoryIds ?? [];
    if (!categoryIds.includes('luxury')) continue;

    const aliases = [
      model.modelName,
      model.modelNameTh,
      model.modelNameLo,
      ...(model.searchNames ?? []),
    ]
      .map((a) => String(a ?? '').trim())
      .filter(Boolean);

    for (const alias of aliases) {
      const key = norm(alias);
      if (!key) continue;
      if (!normToBrandEn.has(key)) {
        normToBrandEn.set(key, brandEnLower);
      }
    }
  }
}

const luxuryData = loadJson(luxuryPath);
const modelNames = luxuryData.modelNames ?? [];

const updatedModelNames = modelNames.map((name) => {
  const s = String(name ?? '').trim();
  if (!shouldPrefix(s)) return name;

  const key = norm(s);
  const brandEn = normToBrandEn.get(key);
  if (brandEn) {
    return `${brandEn} ${s}`;
  }
  return name;
});

luxuryData.modelNames = updatedModelNames;
saveJson(luxuryPath, luxuryData);

console.log('Updated luxury.json: prepended English brand name for short/numeric model names (1–3 chars or all digits).');
