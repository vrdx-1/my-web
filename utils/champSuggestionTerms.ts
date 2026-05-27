type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const CHAMP_SUGGESTION_TERMS: string[] = [
  'ແຊ້ມ',
  'ແຊມ',
  'ແຊ່ມ',
  'ແຊັ້ມ',
  'ແຊັມ',
  'ແຊັ່ມ',
  'cham',
  'champ',
];

const CHAMP_SUGGESTION_TERMS_BY_LENGTH_DESC = [...CHAMP_SUGGESTION_TERMS].sort(
  (left, right) => right.length - left.length,
);

function normalizeText(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeChampTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  // Remove longer aliases first to avoid partial stripping (e.g. "champ" by "cham").
  for (const term of CHAMP_SUGGESTION_TERMS_BY_LENGTH_DESC) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableChampTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of CHAMP_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return CHAMP_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
