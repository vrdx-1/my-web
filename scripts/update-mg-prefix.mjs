#!/usr/bin/env node
/**
 * อัปเดต mg.json ให้ทุกรุ่นมีคำนำหน้า MG และ ເອັມຈີ ในชื่อและ searchNames
 * เพื่อให้ค้น "MG" หรือ "ເອັມຈີ" แล้วได้เฉพาะรถ MG ลดผลที่ไม่เกี่ยวข้อง
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const mgPath = join(rootDir, 'data', 'brands', 'mg.json');

const PREFIX_EN = 'MG';
const PREFIX_LO = 'ເອັມຈີ';
const PREFIX_TH = 'เอ็มจี';

function stripPrefix(name) {
  if (!name || typeof name !== 'string') return name;
  let s = name
    .replace(/^MG\s+/i, '')
    .replace(/^ເອັມຈີ\s*/, '')
    .replace(/^เอ็มจี\s*/, '')
    .trim();
  return s || name;
}

const raw = readFileSync(mgPath, 'utf-8');
const data = JSON.parse(raw);

for (const model of data.models) {
  const base = stripPrefix(model.modelName || model.modelId || '');
  const baseLo = stripPrefix(model.modelNameLo || base);
  const baseTh = stripPrefix(model.modelNameTh || base);

  const nameEn = `${PREFIX_EN} ${base}`.trim();
  const nameLo = `${PREFIX_LO} ${baseLo}`.trim();
  const nameTh = `${PREFIX_TH} ${baseTh}`.trim();

  model.modelName = nameEn;
  model.modelNameTh = nameTh;
  model.modelNameLo = nameLo;

  const searchSet = new Set();
  searchSet.add(nameEn.toLowerCase());
  searchSet.add(`mg ${base}`.trim().toLowerCase());
  searchSet.add(nameLo);
  searchSet.add(`${PREFIX_LO} ${base}`.trim());
  searchSet.add(PREFIX_LO + base.replace(/\s/g, ''));
  for (const s of model.searchNames || []) {
    const t = String(s).trim();
    if (t) searchSet.add(t);
  }
  model.searchNames = [...searchSet];
}

writeFileSync(mgPath, JSON.stringify(data, null, 2), 'utf-8');
console.log('Updated', data.models.length, 'models in mg.json');
