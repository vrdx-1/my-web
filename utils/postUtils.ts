/**
 * Utility functions for post-related operations
 * Shared across multiple pages for better maintainability
 */

import { safeParseJSON } from './storageUtils';
import carsData from '@/data';
import categoriesData from '@/data/categories.json';

// ---- Car dictionary search helpers (moved here to avoid extra files) ----
// NOTE: This preserves existing UX/UI. Only module location changed.

type CarsDictionary = typeof carsData;
type CategoriesDictionary = typeof categoriesData;

type EntityKey = `brand:${string}` | `model:${string}:${string}`;
type CategoryId = string;

const THAI_RE = /[\u0E00-\u0E7F]/;
const LAO_RE = /[\u0E80-\u0EFF]/;
const LATIN_RE = /[a-zA-Z0-9]/;

function normalizeCarSearch(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function uniqStringsCarSearch(items: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const v = String(item ?? '').trim();
    if (!v) continue;
    const k = normalizeCarSearch(v);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function pickShortestMatching(items: string[], re: RegExp): string | null {
  const matches = items.filter((s) => re.test(s));
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.length - b.length);
  return matches[0] ?? null;
}

function buildModelDisplay(
  searchNames: string[],
  modelName: string | undefined,
  modelNameLo: string | undefined,
  modelNameTh: string | undefined,
  lang: SearchLanguage,
): string {
  const pool = uniqStringsCarSearch([...(searchNames ?? []), modelName, modelNameLo, modelNameTh]);

  if (lang === 'latin') {
    // ผู้ใช้พิมพ์ภาษาอังกฤษ → แสดงเฉพาะชื่อภาษาอังกฤษ/โรมันที่สั้นและชัดที่สุด
    const bestEn = pickShortestMatching(pool, LATIN_RE) ?? modelName ?? pool[0] ?? '';
    return bestEn;
  }

  if (lang === 'lo') {
    const bestLo = pickShortestMatching(pool, LAO_RE) ?? modelNameLo ?? '';
    if (bestLo) return bestLo;
    // fallback ถ้าไม่มีลาวเลย
    const bestEn = pickShortestMatching(pool, LATIN_RE) ?? modelName ?? pool[0] ?? '';
    return bestEn;
  }

  if (lang === 'th') {
    const bestTh = pickShortestMatching(pool, THAI_RE) ?? modelNameTh ?? '';
    if (bestTh) return bestTh;
    const bestEn = pickShortestMatching(pool, LATIN_RE) ?? modelName ?? pool[0] ?? '';
    return bestEn;
  }

  // ภาษาอื่น ๆ → เลือกตัวแรกที่มี
  return pool[0] ?? modelName ?? '';
}

type EntityInfo =
  | { kind: 'brand'; brandId: string; brandName?: string; brandNameTh?: string; brandNameLo?: string }
  | {
      kind: 'model';
      brandId: string;
      modelId: string;
      modelName?: string;
      modelNameTh?: string;
      modelNameLo?: string;
      searchNames: string[];
    };

function buildIndexes(dict: CarsDictionary) {
  const entityAliases = new Map<EntityKey, Set<string>>();
  const aliasToEntities = new Map<string, Set<EntityKey>>();
  const aliasNormToRaw = new Map<string, string>();
  const entityInfo = new Map<EntityKey, EntityInfo>();
  const brandToModelKeys = new Map<string, Set<EntityKey>>();
  const modelToBrandKey = new Map<EntityKey, EntityKey>();

  function addAlias(entity: EntityKey, raw: string) {
    const alias = String(raw ?? '').trim();
    if (!alias) return;
    const key = normalizeCarSearch(alias);
    if (!key) return;

    if (!entityAliases.has(entity)) entityAliases.set(entity, new Set());
    entityAliases.get(entity)!.add(alias);

    if (!aliasToEntities.has(key)) aliasToEntities.set(key, new Set());
    aliasToEntities.get(key)!.add(entity);

    if (!aliasNormToRaw.has(key)) aliasNormToRaw.set(key, alias);
  }

  function addAliasWithTokens(entity: EntityKey, raw: string) {
    const text = String(raw ?? '').trim();
    if (!text) return;
    addAlias(entity, text);

    // Also index individual tokens so partial captions can match.
    const tokens = normalizeCarSearch(text)
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean);
    const rawTokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);

    for (let i = 0; i < Math.min(tokens.length, rawTokens.length); i++) {
      const rawTok = rawTokens[i];
      if (!rawTok) continue;
      if (rawTok.length < 2) continue;
      addAlias(entity, rawTok);
    }
  }

  for (const brand of dict.brands ?? []) {
    const brandKey: EntityKey = `brand:${brand.brandId}`;
    brandToModelKeys.set(brandKey, new Set());
    entityInfo.set(brandKey, {
      kind: 'brand',
      brandId: String(brand.brandId),
      brandName: brand.brandName,
      brandNameTh: brand.brandNameTh as any,
      brandNameLo: brand.brandNameLo as any,
    });
    addAliasWithTokens(brandKey, brand.brandName);
    addAliasWithTokens(brandKey, brand.brandNameTh as any);
    addAliasWithTokens(brandKey, brand.brandNameLo as any);
    for (const a of (brand as any).brandSearchNames ?? []) addAliasWithTokens(brandKey, String(a));

    for (const model of brand.models ?? []) {
      const modelKey: EntityKey = `model:${brand.brandId}:${model.modelId}`;
      brandToModelKeys.get(brandKey)!.add(modelKey);
      modelToBrandKey.set(modelKey, brandKey);
      entityInfo.set(modelKey, {
        kind: 'model',
        brandId: String(brand.brandId),
        modelId: String(model.modelId),
        modelName: model.modelName,
        modelNameTh: (model as any).modelNameTh,
        modelNameLo: (model as any).modelNameLo,
        searchNames: ((model.searchNames ?? []) as any[]).map(String),
      });

      addAliasWithTokens(modelKey, model.modelName);
      addAliasWithTokens(modelKey, (model as any).modelNameTh);
      addAliasWithTokens(modelKey, (model as any).modelNameLo);
      for (const s of (model.searchNames ?? []) as any[]) addAliasWithTokens(modelKey, String(s));

      const bName = brand.brandName ?? '';
      const bNameTh = (brand.brandNameTh as string) ?? '';
      const bNameLo = (brand.brandNameLo as string) ?? '';
      if (bName) {
        addAliasWithTokens(modelKey, `${bName} ${model.modelName}`.trim());
        for (const s of (model.searchNames ?? []) as any[]) {
          const sn = String(s).trim();
          if (sn) addAliasWithTokens(modelKey, `${bName} ${sn}`.trim());
        }
      }
      if (bNameTh && (model as any).modelNameTh)
        addAliasWithTokens(modelKey, `${bNameTh} ${(model as any).modelNameTh}`.trim());
      if (bNameLo && (model as any).modelNameLo)
        addAliasWithTokens(modelKey, `${bNameLo} ${(model as any).modelNameLo}`.trim());
    }
  }

  return { entityAliases, aliasToEntities, aliasNormToRaw, entityInfo, brandToModelKeys, modelToBrandKey };
}

function buildCategoryAliasIndex(dict: CategoriesDictionary) {
  const aliasToCategoryIds = new Map<string, Set<CategoryId>>();

  function addAlias(categoryId: string, raw: string) {
    const v = String(raw ?? '').trim();
    if (!v) return;
    const k = normalizeCarSearch(v);
    if (!k) return;
    if (!aliasToCategoryIds.has(k)) aliasToCategoryIds.set(k, new Set());
    aliasToCategoryIds.get(k)!.add(String(categoryId));
  }

  for (const group of (dict as any).categoryGroups ?? []) {
    for (const cat of group.categories ?? []) {
      const id = String(cat.id);
      addAlias(id, id);
      addAlias(id, cat.name);
      addAlias(id, cat.nameLo);
      addAlias(id, cat.nameEn);
    }
  }

  // searchTermAliases from categories.json: family/ครอบครัว, delivery/รถขนของ, hilux/ไฮลักซ์
  const searchTermAliases = (dict as any).searchTermAliases ?? [];
  for (const entry of searchTermAliases) {
    const terms = entry.terms ?? [];
    const categoryIds = entry.categoryIds ?? [];
    for (const term of terms) {
      for (const cid of categoryIds) addAlias(String(cid), term);
    }
  }

  // Extra common search words that users type (map to existing categories)
  addAlias('offroad', 'jeep');
  addAlias('offroad', 'จี๊ป');
  addAlias('offroad', 'จิบ');
  addAlias('offroad', 'ຈີບ');
  addAlias('pickup', 'truck');
  addAlias('pickup', 'รถกระบะ');
  addAlias('van', 'รถตู้');
  addAlias('sedan', 'รถเก๋ง');
  addAlias('electric', 'ev');
  addAlias('electric', 'electric car');
  addAlias('electric', 'รถไฟฟ้า');

  return { aliasToCategoryIds };
}

function buildCategoryToModelAliases(dict: CarsDictionary) {
  const categoryToAliases = new Map<CategoryId, Set<string>>();

  function add(categoryId: string, alias: string) {
    const v = String(alias ?? '').trim();
    if (!v) return;
    if (!categoryToAliases.has(categoryId)) categoryToAliases.set(categoryId, new Set());
    categoryToAliases.get(categoryId)!.add(v);
  }

  for (const brand of dict.brands ?? []) {
    for (const model of brand.models ?? []) {
      const categoryIds = (model.categoryIds ?? []) as string[];
      if (!categoryIds || categoryIds.length === 0) continue;

      const aliases = uniqStringsCarSearch([
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ]);

      for (const cid of categoryIds) {
        const catId = String(cid);
        for (const a of aliases) {
          add(catId, a);
          const tokens = a.split(/\s+/).map((t) => t.trim()).filter(Boolean);
          for (const tok of tokens) if (tok.length >= 2) add(catId, tok);
        }

        // Special case: allow searching pickup by Ford brand name only (e.g. caption "ຟອດ").
        // Keeps other categories unchanged.
        if (catId === 'pickup' && String(brand.brandId) === 'ford') {
          add('pickup', brand.brandName);
          add('pickup', brand.brandNameTh as any);
          add('pickup', brand.brandNameLo as any);
        }
      }
    }
  }

  return { categoryToAliases };
}

const CAR_INDEX = buildIndexes(carsData);
const CATEGORY_INDEX = buildCategoryAliasIndex(categoriesData);
const CATEGORY_TO_MODEL_ALIASES = buildCategoryToModelAliases(carsData);

function getCategoryDisplayName(categoryId: string, lang: SearchLanguage): string {
  const groups = (categoriesData as any).categoryGroups ?? [];
  for (const group of groups) {
    for (const cat of group.categories ?? []) {
      if (String(cat.id) !== String(categoryId)) continue;
      const name = cat.name ?? '';
      const nameEn = cat.nameEn ?? '';
      const nameLo = cat.nameLo ?? '';
      if (lang === 'latin') return nameEn || name || nameLo || categoryId;
      if (lang === 'lo') return nameLo || name || nameEn || categoryId;
      if (lang === 'th') return name || nameEn || nameLo || categoryId;
      return name || nameEn || nameLo || categoryId;
    }
  }
  return categoryId;
}

export type SearchLanguage = 'lo' | 'th' | 'latin' | 'other';

export function detectSearchLanguage(query: string): SearchLanguage {
  const q = String(query ?? '');
  if (LAO_RE.test(q)) return 'lo';
  if (THAI_RE.test(q)) return 'th';
  if (LATIN_RE.test(q)) return 'latin';
  return 'other';
}

export function captionHasSearchLanguage(caption: string, lang: SearchLanguage): boolean {
  const c = String(caption ?? '');
  if (!c) return false;
  if (lang === 'lo') return LAO_RE.test(c);
  if (lang === 'th') return THAI_RE.test(c);
  if (lang === 'latin') return /[a-zA-Z]/.test(c);
  return true;
}

function levenshteinWithin(a: string, b: string, maxDist: number): number | null {
  if (a === b) return 0;
  if (maxDist < 0) return null;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDist) return null;
  if (al > bl) return levenshteinWithin(b, a, maxDist);

  let prev = new Array(al + 1).fill(0).map((_, i) => i);
  for (let j = 1; j <= bl; j++) {
    const bj = b.charCodeAt(j - 1);
    const cur = new Array(al + 1);
    cur[0] = j;
    let rowMin = cur[0];
    for (let i = 1; i <= al; i++) {
      const cost = a.charCodeAt(i - 1) === bj ? 0 : 1;
      const del = prev[i] + 1;
      const ins = cur[i - 1] + 1;
      const sub = prev[i - 1] + cost;
      const v = Math.min(del, ins, sub);
      cur[i] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return null;
    prev = cur;
  }
  return prev[al] <= maxDist ? prev[al] : null;
}

function scoreAliasForQuery(aliasNorm: string, queryNorm: string): number | null {
  if (!aliasNorm || !queryNorm) return null;
  if (aliasNorm.startsWith(queryNorm)) return 10000 - aliasNorm.length;
  const idx = aliasNorm.indexOf(queryNorm);
  if (idx >= 0) return 7000 - (idx * 50) - aliasNorm.length;
  if (queryNorm.length >= 3) {
    const maxDist = queryNorm.length >= 6 ? 2 : 1;
    const dist = levenshteinWithin(aliasNorm, queryNorm, maxDist);
    if (dist !== null) return 4000 - (dist * 200) - aliasNorm.length;
  }
  return null;
}

export function expandCarSearchAliases(query: string): string[] {
  const qNorm = normalizeCarSearch(query);
  if (!qNorm) return [];

  const entities = CAR_INDEX.aliasToEntities.get(qNorm);
  if (entities && entities.size > 0) {
    const out: string[] = [query];
    for (const entity of entities) {
      const aliases = CAR_INDEX.entityAliases.get(entity);
      if (aliases) out.push(...aliases);

      const info = CAR_INDEX.entityInfo.get(entity);
      if (!info) continue;

      // If searching by BRAND: also expand to all MODELS under that brand,
      // so a caption that contains only the model (no brand) still matches.
      if (info.kind === 'brand') {
        const modelKeys = CAR_INDEX.brandToModelKeys.get(entity);
        if (modelKeys) {
          for (const mk of modelKeys) {
            const mAliases = CAR_INDEX.entityAliases.get(mk);
            if (mAliases) out.push(...mAliases);
          }
        }
      }

      // If searching by MODEL: also include the BRAND aliases (best effort).
      if (info.kind === 'model') {
        const bk = CAR_INDEX.modelToBrandKey.get(entity);
        if (bk) {
          const bAliases = CAR_INDEX.entityAliases.get(bk);
          if (bAliases) out.push(...bAliases);
        }
      }
    }
    return uniqStringsCarSearch(out);
  }

  // ถ้าไม่พบใน dictionary ของยี่ห้อ/รุ่นเลย ค่อย fallback ไปใช้ category (pickup/van/EV ฯลฯ)
  const categoryIds = CATEGORY_INDEX.aliasToCategoryIds.get(qNorm);
  if (categoryIds && categoryIds.size > 0) {
    const expanded: string[] = [query];
    const groups = (categoriesData as any).categoryGroups ?? [];
    for (const cid of categoryIds) {
      expanded.push(String(cid));
      for (const g of groups) {
        for (const cat of g.categories ?? []) {
          if (String(cat.id) === String(cid)) {
            if (cat.name) expanded.push(String(cat.name).trim());
            if (cat.nameEn) expanded.push(String(cat.nameEn).trim());
            if (cat.nameLo) expanded.push(String(cat.nameLo).trim());
            break;
          }
        }
      }
      // ดูรุ่นไหนมีหมวด cid แล้วใส่ชื่อรุ่นครบ 3 ภาษา (modelName, modelNameTh, modelNameLo, searchNames) จากต้นทาง
      for (const brand of carsData.brands ?? []) {
        for (const model of brand.models ?? []) {
          const modelCats = (model.categoryIds ?? []) as string[];
          if (!modelCats.includes(String(cid))) continue;
          const terms = [
            model.modelName,
            (model as any).modelNameTh,
            (model as any).modelNameLo,
            ...((model.searchNames ?? []) as any[]).map(String),
          ];
          for (const t of terms) {
            const s = String(t ?? '').trim();
            if (!s) continue;
            expanded.push(s);
            const tokens = s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
            for (const tok of tokens) if (tok.length >= 2) expanded.push(tok);
          }
        }
      }
      const aliases = CATEGORY_TO_MODEL_ALIASES.categoryToAliases.get(String(cid));
      if (aliases) {
        expanded.push(...aliases);
        for (const a of aliases) {
          const tokens = String(a ?? '').split(/\s+/).map((t) => t.trim()).filter(Boolean);
          for (const tok of tokens) if (tok.length >= 2) expanded.push(tok);
        }
      }
    }
    return uniqStringsCarSearch(expanded);
  }

  // ถ้าไม่เข้าเคสใดเลย ให้คืน query เดิมเพื่อไม่ให้เงียบหาย
  return [query];
}

function normalizeForFallback(text: string): string {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const BRAND_NAMES_SET = (() => {
  const set = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    const en = String(brand.brandName ?? '').trim();
    const th = String((brand as any).brandNameTh ?? '').trim();
    const lo = String((brand as any).brandNameLo ?? '').trim();
    if (en) set.add(normalizeForFallback(en));
    if (th) set.add(normalizeForFallback(th));
    if (lo) set.add(normalizeForFallback(lo));
  }
  return set;
})();

/**
 * ขยายคำค้นโดยกรอง brand aliases และ model อื่นออกเมื่อค้นรุ่น (ให้ผลตรงคำค้น)
 * ใช้ฝั่ง frontend เพื่อเลือกชุดคำส่งให้ API/DB
 */
export function expandWithoutBrandAliases(query: string): string[] {
  const expanded = expandCarSearchAliases(query);
  if (expanded.length <= 1) return expanded;

  const queryNorm = normalizeCarSearch(query);
  if (BRAND_NAMES_SET.has(normalizeForFallback(query))) return expanded;

  // ค้นหาหมวดหมู่ (pickup/van/sedan ฯลฯ) — ส่งเฉพาะชื่อรุ่นจากพจนานุกรม (data/brands) ครบ 3 ภาษา + searchNames ไม่ใส่ชื่อหมวดจาก categories
  const categoryIds = CATEGORY_INDEX.aliasToCategoryIds.get(queryNorm);
  if (categoryIds && categoryIds.size > 0) {
    const currentCids = new Set(Array.from(categoryIds).map(String));
    // ไม่ใส่คำที่ตรงกับ alias ของหมวดอื่น (เช่น "sport" จะไม่ใส่ตอนค้น suv เพื่อไม่ให้โพสที่พูดแค่รถสปอร์ตโผล่)
    const isOtherCategoryAlias = (termNorm: string): boolean => {
      const ids = CATEGORY_INDEX.aliasToCategoryIds.get(termNorm);
      if (!ids || ids.size === 0) return false;
      for (const id of ids) if (currentCids.has(String(id))) return false;
      return true;
    };
    const out = new Set<string>();
    for (const cid of categoryIds) {
      for (const brand of carsData.brands ?? []) {
        for (const model of brand.models ?? []) {
          const modelCats = (model.categoryIds ?? []) as string[];
          if (!modelCats.includes(String(cid))) continue;
          const terms = [
            model.modelName,
            (model as any).modelNameTh,
            (model as any).modelNameLo,
            ...((model.searchNames ?? []) as any[]).map(String),
          ];
          for (const t of terms) {
            const s = String(t ?? '').trim();
            if (!s) continue;
            if (BRAND_NAMES_SET.has(normalizeForFallback(s))) continue;
            const sNorm = normalizeCarSearch(s);
            if (sNorm && isOtherCategoryAlias(sNorm)) continue;
            out.add(s);
          }
        }
      }
    }
    const filtered = Array.from(out).filter((term) => {
      const termNorm = normalizeForFallback(term);
      return !BRAND_NAMES_SET.has(termNorm);
    });
    return filtered.length > 0 ? filtered : [query];
  }

  const matchingEntities = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      const modelAliasesNorm = modelAliases.map((a) => normalizeCarSearch(String(a ?? ''))).filter(Boolean);
      const matchByQuery = modelAliasesNorm.includes(queryNorm);
      // จำกัดให้จับแค่รุ่นที่ตรงกับคำค้นเองเท่านั้น (ไม่ดึงรุ่นอื่นที่แชร์คำกว้าง ๆ ร่วมกัน เช่น "hilux")
      if (matchByQuery) {
        matchingEntities.add(`model:${brand.brandId}:${model.modelId}`);
      }
    }
  }

  if (matchingEntities.size === 0) {
    const filtered = expanded.filter((term) => {
      const termNorm = normalizeForFallback(term);
      return !BRAND_NAMES_SET.has(termNorm) || termNorm === normalizeForFallback(query);
    });
    return filtered.length > 0 ? filtered : [query];
  }

  const otherModelAliases = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const entityKey = `model:${brand.brandId}:${model.modelId}`;
      if (matchingEntities.has(entityKey)) continue;
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      for (const alias of modelAliases) {
        const a = String(alias ?? '').trim();
        if (a) {
          otherModelAliases.add(a);
          otherModelAliases.add(normalizeCarSearch(a));
        }
      }
    }
  }

  const validAliases = new Set<string>();
  validAliases.add(query);

  function addAliasAndTokens(alias: string, isAllowed: (a: string) => boolean) {
    const a = String(alias ?? '').trim();
    if (!a) return;
    if (isAllowed(a)) validAliases.add(a);
    const rawTokens = a.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (const rawTok of rawTokens) {
      if (rawTok.length >= 2 && isAllowed(rawTok)) validAliases.add(rawTok);
    }
  }

  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const entityKey = `model:${brand.brandId}:${model.modelId}`;
      if (!matchingEntities.has(entityKey)) continue;
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      for (const alias of modelAliases) {
        const a = String(alias ?? '').trim();
        if (!a) continue;
        const isAllowed = (t: string) =>
          normalizeCarSearch(t) === queryNorm ||
          (!otherModelAliases.has(t) && !otherModelAliases.has(normalizeCarSearch(t)));
        addAliasAndTokens(a, isAllowed);
      }
    }
  }

  const result = Array.from(validAliases).filter(Boolean);
  return result.length > 0 ? result : [query];
}

export function captionMatchesAnyAlias(caption: string, queries: string[]): boolean {
  const c = normalizeCarSearch(caption);
  if (!c) return false;
  const tokens = c.split(' ').filter(Boolean);
  for (const q of queries ?? []) {
    const qn = normalizeCarSearch(q);
    if (!qn) continue;
    // ตรงเป๊ะหรือเป็น substring เหมือนเดิม
    if (c.includes(qn)) return true;

    // typo tolerance: ถ้าพิมพ์ผิด 1 ตัวอักษร ให้พยายามเดา
    if (qn.length >= 3) {
      for (const t of tokens) {
        const dist = levenshteinWithin(t, qn, 1);
        if (dist !== null) return true;
      }
    }
  }
  return false;
}

export type CarSuggestionItem = { display: string; searchKey: string };

const CUSTOM_SUGGESTIONS: CarSuggestionItem[] = [
  { display: 'ລົດຍ້າຍພວງ', searchKey: 'ຍ້າຍພວງ' },
  { display: 'ລົດຊ້າຍເດີມ', searchKey: 'ຊ້າຍເດີມ' },
  { display: 'ລົດສູນລາວ', searchKey: 'ສູນລາວ' },
];

export function getCarDictionarySuggestions(prefix: string, limit = 9): CarSuggestionItem[] {
  const qNorm = normalizeCarSearch(prefix);
  if (!qNorm) return [];

  const lang = detectSearchLanguage(prefix);

  const bestByEntity = new Map<EntityKey, { score: number; matchedAliasNorm: string }>();

  for (const [aliasNorm, entities] of CAR_INDEX.aliasToEntities.entries()) {
    const score = scoreAliasForQuery(aliasNorm, qNorm);
    if (score === null) continue;
    for (const entity of entities) {
      const prev = bestByEntity.get(entity);
      if (!prev || score > prev.score) bestByEntity.set(entity, { score, matchedAliasNorm: aliasNorm });
    }
  }

  const bestByCategory = new Map<CategoryId, { score: number; matchedAliasNorm: string }>();
  for (const [aliasNorm, categoryIds] of CATEGORY_INDEX.aliasToCategoryIds.entries()) {
    const score = scoreAliasForQuery(aliasNorm, qNorm);
    if (score === null) continue;
    for (const cid of categoryIds) {
      const prev = bestByCategory.get(cid);
      if (!prev || score > prev.score) bestByCategory.set(cid, { score, matchedAliasNorm: aliasNorm });
    }
  }

  const items: Array<CarSuggestionItem & { _score: number }> = [];

  for (const [entity, m] of bestByEntity.entries()) {
    const info = CAR_INDEX.entityInfo.get(entity);
    if (!info) continue;

    const matchedRaw = CAR_INDEX.aliasNormToRaw.get(m.matchedAliasNorm) ?? prefix;

    // helper: เลือกชื่อแบรนด์ตามภาษา
    const pickBrandDisplay = (b: { brandName?: string; brandNameTh?: string; brandNameLo?: string }): string => {
      if (lang === 'latin') return b.brandName ?? '';
      if (lang === 'lo') return (b.brandNameLo as string) || b.brandName || (b.brandNameTh as string) || '';
      if (lang === 'th') return (b.brandNameTh as string) || b.brandName || (b.brandNameLo as string) || '';
      return b.brandName ?? '';
    };

    // แสดงผลตามภาษาที่ผู้ใช้พิมพ์ (อังกฤษ/ไทย/ลาว) — ค้นหารุ่นอย่างเดียวแสดงแค่ชื่อรุ่น, ค้นหาแบรนด์จะแสดง แบรนด์+รุ่น (ในบล็อกด้านล่าง)
    let display = '';
    if (info.kind === 'model') {
      const modelDisplay = buildModelDisplay(
        info.searchNames ?? [],
        info.modelName,
        info.modelNameLo,
        info.modelNameTh,
        lang,
      );
      display = modelDisplay;
    } else {
      display = pickBrandDisplay(info);
    }

    if (!display) continue;
    items.push({ display, searchKey: matchedRaw, _score: m.score });

    // ถ้าเป็นการ match ที่ BRAND: แนะนำรุ่นต่าง ๆ ของแบรนด์นั้นต่อจากชื่อแบรนด์
    if (info.kind === 'brand') {
      const brandDisplay = display;
      const modelKeys = CAR_INDEX.brandToModelKeys.get(entity);
      if (modelKeys) {
        let added = 0;
        for (const mk of modelKeys) {
          const mInfo = CAR_INDEX.entityInfo.get(mk);
          if (!mInfo || mInfo.kind !== 'model') continue;

          const modelDisplay = buildModelDisplay(
            mInfo.searchNames ?? [],
            mInfo.modelName,
            mInfo.modelNameLo,
            mInfo.modelNameTh,
            lang,
          );
          if (!modelDisplay) continue;

          const fullDisplay = uniqStringsCarSearch([brandDisplay, modelDisplay]).join(' ');
          if (!fullDisplay) continue;

          items.push({
            display: fullDisplay,
            // พอผู้ใช้คลิกรุ่น ให้ค้นด้วยชื่อรุ่นตามภาษาที่แสดง
            searchKey: fullDisplay,
            _score: m.score - 1, // ให้คะแนนต่ำกว่าชื่อแบรนด์เล็กน้อย
          });

          added++;
          if (added >= 6) break; // จำกัดจำนวนรุ่นแนะนำต่อแบรนด์
        }
      }
    }
  }

  for (const [categoryId, m] of bestByCategory.entries()) {
    const display = getCategoryDisplayName(categoryId, lang);
    if (!display.trim()) continue;
    items.push({ display, searchKey: categoryId, _score: m.score });
  }

  for (const custom of CUSTOM_SUGGESTIONS) {
    const dNorm = normalizeCarSearch(custom.display);
    const sNorm = normalizeCarSearch(custom.searchKey);
    if (
      qNorm &&
      (dNorm.startsWith(qNorm) || dNorm === qNorm || sNorm.startsWith(qNorm) || sNorm === qNorm)
    ) {
      items.push({ display: custom.display, searchKey: custom.searchKey, _score: 5000 });
    }
  }

  items.sort((a, b) => b._score - a._score);

  const direct: typeof items = [];
  const rest: typeof items = [];
  for (const it of items) {
    const dNorm = normalizeCarSearch(it.display);
    const sNorm = normalizeCarSearch(it.searchKey);
    const isDirect =
      !!qNorm &&
      (dNorm.startsWith(qNorm) || dNorm === qNorm || sNorm.startsWith(qNorm) || sNorm === qNorm);
    if (isDirect) direct.push(it);
    else rest.push(it);
  }
  const result = [
    ...direct,
    ...rest.slice(0, Math.max(0, limit - direct.length)),
  ];
  return result.map(({ display, searchKey }) => ({ display, searchKey }));
}

export interface OnlineStatus {
  isOnline: boolean;
  text: string;
}

/**
 * Get online status based on last seen timestamp
 */
export const getOnlineStatus = (lastSeen: string | null): OnlineStatus => {
  if (!lastSeen) return { isOnline: false, text: '' };
  const now = new Date().getTime();
  const lastActive = new Date(lastSeen).getTime();
  const diffInSeconds = Math.floor((now - lastActive) / 1000);
  
  if (diffInSeconds < 300) return { isOnline: true, text: 'ອອນລາຍ' };
  if (diffInSeconds < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ເມື່ອຄູ່` };
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMinutes} ນາທີທີ່ແລ້ວ` };
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່ແລ້ວ` };
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື້ທີ່ແລ້ວ` };
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInWeeks} ອາທິດທີ່ແລ້ວ` };
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMonths} ເດືອນທີ່ແລ້ວ` };
  
  const diffInYears = Math.floor(diffInDays / 365);
  return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInYears} ປີທີ່ແລ້ວ` };
};

/**
 * Format time difference from now
 */
export const formatTime = (dateString: string): string => {
  const now = new Date().getTime();
  const postTime = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - postTime) / 1000);
  
  if (diffInSeconds < 60) return 'ເມື່ອຄູ່';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} ນາທີ`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ຊົ່ວໂມງ`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ມື້`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks} ອາທິດ`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} ເດືອນ`;
  
  const diffInYears = Math.floor(diffInDays / 365);
  if (diffInYears >= 1) return `${diffInYears} ປີທີ່ແລ້ວ`;
  
  return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
};

/**
 * Check if current user is the owner of the post
 */
export const isPostOwner = (post: any, session: any): boolean => {
  if (session && String(post.user_id) === String(session.user.id)) return true;
  
  if (typeof window === 'undefined') return false;
  const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
  return stored.some((item: any) => String(item.post_id) === String(post.id));
};

/**
 * Get primary guest token from localStorage
 */
export const getPrimaryGuestToken = (): string => {
  if (typeof window === 'undefined') return '';
  const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
  if (stored.length > 0 && stored[0]?.token) return stored[0].token;
  
  let deviceToken = localStorage.getItem('device_guest_token');
  if (!deviceToken) {
    deviceToken = 'guest-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_guest_token', deviceToken);
  }
  return deviceToken;
};
