import carsData from '@/data/cars.json';

type CarsDictionary = typeof carsData;

type EntityKey = `brand:${string}` | `model:${string}:${string}`;

const THAI_RE = /[\u0E00-\u0E7F]/;
const LAO_RE = /[\u0E80-\u0EFF]/;
const LATIN_RE = /[a-zA-Z0-9]/;

function normalize(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function uniqStrings(items: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const v = String(item ?? '').trim();
    if (!v) continue;
    const k = normalize(v);
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

function buildModelDisplay(searchNames: string[], modelName?: string, modelNameLo?: string, modelNameTh?: string): string {
  const pool = uniqStrings([...(searchNames ?? []), modelName, modelNameLo, modelNameTh]);

  const bestEn = pickShortestMatching(pool, LATIN_RE) ?? modelName ?? pool[0] ?? '';
  const bestLo = pickShortestMatching(pool, LAO_RE) ?? modelNameLo ?? '';
  const bestTh = pickShortestMatching(pool, THAI_RE) ?? modelNameTh ?? '';

  return uniqStrings([bestEn, bestLo, bestTh]).join(', ');
}

function buildIndexes(dict: CarsDictionary) {
  const entityAliases = new Map<EntityKey, Set<string>>();
  const aliasToEntities = new Map<string, Set<EntityKey>>();

  function addAlias(entity: EntityKey, raw: string) {
    const alias = String(raw ?? '').trim();
    if (!alias) return;
    const key = normalize(alias);
    if (!key) return;

    if (!entityAliases.has(entity)) entityAliases.set(entity, new Set());
    entityAliases.get(entity)!.add(alias);

    if (!aliasToEntities.has(key)) aliasToEntities.set(key, new Set());
    aliasToEntities.get(key)!.add(entity);
  }

  function addAliasWithTokens(entity: EntityKey, raw: string) {
    const text = String(raw ?? '').trim();
    if (!text) return;
    addAlias(entity, text);

    // Also index individual tokens so a caption that contains only a part
    // (e.g. "ຣີໂວ້") can still match even if the dictionary has a longer phrase
    // (e.g. "ໄຮລັກຊ໌ ຣີໂວ້").
    const tokens = normalize(text)
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean);

    // Add the original token (best effort) by re-splitting raw on whitespace.
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
    addAliasWithTokens(brandKey, brand.brandName);
    addAliasWithTokens(brandKey, brand.brandNameTh as any);
    addAliasWithTokens(brandKey, brand.brandNameLo as any);

    for (const model of brand.models ?? []) {
      const modelKey: EntityKey = `model:${brand.brandId}:${model.modelId}`;
      addAliasWithTokens(modelKey, model.modelName);
      addAliasWithTokens(modelKey, (model as any).modelNameTh);
      addAliasWithTokens(modelKey, (model as any).modelNameLo);
      for (const s of (model.searchNames ?? []) as any[]) addAliasWithTokens(modelKey, String(s));
    }
  }

  return { entityAliases, aliasToEntities };
}

const INDEX = buildIndexes(carsData);

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
  return true; // 'other' => no preference
}

function levenshteinWithin(a: string, b: string, maxDist: number): number | null {
  // Small, early-exit Levenshtein (sufficient for short search strings).
  if (a === b) return 0;
  if (maxDist < 0) return null;

  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDist) return null;

  // Ensure b is the longer string
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

  // Strong preference: startsWith
  if (aliasNorm.startsWith(queryNorm)) {
    return 10000 - aliasNorm.length;
  }

  // Next: contains (still useful for "hilux revo" when typing "revo")
  const idx = aliasNorm.indexOf(queryNorm);
  if (idx >= 0) {
    return 7000 - (idx * 50) - aliasNorm.length;
  }

  // Fuzzy match for small typos, but only when query is long enough to avoid noise.
  if (queryNorm.length < 2) return null;

  const maxDist =
    queryNorm.length <= 4 ? 1 :
    queryNorm.length <= 7 ? 2 :
    2;

  // Compare query to alias prefix of similar length (autocomplete-like).
  const compareTo = aliasNorm.slice(0, Math.min(aliasNorm.length, queryNorm.length + 1));
  const dist = levenshteinWithin(queryNorm, compareTo, maxDist);
  if (dist === null) return null;

  return 5000 - (dist * 500) - aliasNorm.length;
}

export function expandCarSearchAliases(query: string): string[] {
  const qNorm = normalize(query);
  if (!qNorm) return [];

  const entities = INDEX.aliasToEntities.get(qNorm);
  if (!entities || entities.size === 0) return [query];

  const expanded: string[] = [];
  for (const entity of entities) {
    const aliases = INDEX.entityAliases.get(entity);
    if (!aliases) continue;
    expanded.push(...aliases);
  }

  // Always keep the original query in the set.
  expanded.push(query);
  return uniqStrings(expanded);
}

export function captionMatchesAnyAlias(caption: string, queries: string[]): boolean {
  const c = normalize(caption);
  if (!c) return false;
  for (const q of queries) {
    const qNorm = normalize(q);
    if (!qNorm) continue;
    if (c.includes(qNorm)) return true;
  }
  return false;
}

export interface CarSuggestionItem {
  display: string;
  searchKey: string;
}

export function getCarDictionarySuggestions(prefix: string, limit = 6): CarSuggestionItem[] {
  const p = normalize(prefix);
  if (!p) return [];

  const scored: Array<{ score: number; item: CarSuggestionItem; dedupeKey: string }> = [];
  const seen = new Set<string>(); // dedupe by model+key

  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const searchNames = (model.searchNames ?? []) as string[];
      const aliasesPool = uniqStrings([
        ...searchNames,
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
      ]);

      let bestScore: number | null = null;
      for (const a of aliasesPool) {
        const s = scoreAliasForQuery(normalize(a), p);
        if (s === null) continue;
        if (bestScore === null || s > bestScore) bestScore = s;
      }
      if (bestScore === null) continue;

      const display = buildModelDisplay(
        searchNames,
        model.modelName,
        (model as any).modelNameLo,
        (model as any).modelNameTh,
      );

      // Search key should be something that likely appears in captions (short alias).
      const bestEn = pickShortestMatching(aliasesPool, LATIN_RE) ?? aliasesPool[0] ?? model.modelName;
      const searchKey = String(bestEn ?? '').trim() || model.modelName;
      const dedupeKey = normalize(`${brand.brandId}:${model.modelId}:${searchKey}`);

      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      scored.push({ score: bestScore, item: { display, searchKey }, dedupeKey });
    }
  }

  scored.sort((a, b) => (b.score - a.score) || a.item.display.length - b.item.display.length);
  return scored.slice(0, Math.max(0, limit)).map((s) => s.item);
}

