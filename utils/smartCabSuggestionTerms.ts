type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const SMART_CAB_SUGGESTION_TERMS: string[] = [
  'ສະມາດແຄັບ',
  'ສມາສແຄັບ',
  'ສະມາສແຄັບ',
  'ສະມາດແຄບ',
  'smartcab',
  'ສມາສແຄບ',
  'smart cap',
  'ສະມາສແຄບ',
  'smart-cab',
  'ສມາດແຄບ',
  'smartcap',
  'cap',
  'ສະມັດແຄັບ',
  'ແຄັບ',
  'smardcab',
  'ສມັດແຄັປ',
  'ສະມັດແຄັປ',
];

function normalizeText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeSmartCabTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  for (const term of SMART_CAB_SUGGESTION_TERMS) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableSmartCabTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of SMART_CAB_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return SMART_CAB_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
