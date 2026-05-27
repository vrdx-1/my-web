import { SMART_CAB_SUGGESTION_TERMS } from '@/utils/smartCabSuggestionTerms';

const SMART_CAB_CANONICAL = 'cap';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeSmartCabQueryForSearch(query: string): string {
  const raw = String(query ?? '').trim();
  if (!raw) return '';

  const hasSmartCabTerm = SMART_CAB_SUGGESTION_TERMS.some((term) => {
    const t = String(term ?? '').trim();
    return t ? raw.toLowerCase().includes(t.toLowerCase()) : false;
  });

  const hasSmartCabPattern =
    /[^\s]*ແຄັບ[^\s]*/iu.test(raw)
    || /[^\s]*ແຄບ[^\s]*/iu.test(raw)
    || /smart\s*-?\s*cab/iu.test(raw)
    || /smartcap/iu.test(raw)
    || /\bcap\b/iu.test(raw);

  if (!hasSmartCabTerm && !hasSmartCabPattern) return raw;

  let out = raw;

  const sortedTerms = [...SMART_CAB_SUGGESTION_TERMS]
    .map((term) => String(term ?? '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const term of sortedTerms) {
    const pattern = new RegExp(escapeRegex(term), 'giu');
    out = out.replace(pattern, ` ${SMART_CAB_CANONICAL} `);
  }

  out = out
    .replace(/[^\s]*ແຄັບ[^\s]*/giu, ` ${SMART_CAB_CANONICAL} `)
    .replace(/[^\s]*ແຄບ[^\s]*/giu, ` ${SMART_CAB_CANONICAL} `)
    .replace(/smart\s*-?\s*cab/giu, ` ${SMART_CAB_CANONICAL} `)
    .replace(/smartcap/giu, ` ${SMART_CAB_CANONICAL} `)
    .replace(/\bcap\b/giu, ` ${SMART_CAB_CANONICAL} `)
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}
