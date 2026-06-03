type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const ADVENTURE_SUGGESTION_TERMS: string[] = [
  'ແອັດເວັນເຈີ',
  'adventure',
  'ແອັດແວັນເຈີ',
  'ແອດແວນເຈີ',
  'ແອດແວນເຈີ້',
  'ແອດເວນເຈີ',
  'ແອດເວນເຈີ້',
  'ແອັດແວນເຈີ້',
  'ແອັດເວນເຈີ',
  'ແອັດເວນເຈີ້',
  'ເອດເວນເຈີ',
  'ເອດເວນເຈີ້',
  'ເອັດແວນເຈີ',
  'ເອັດແວນເຈີ້',
  'ເອດເວນເຈີ',
  'ເອດເວນເຈີ້',
];

const ADVENTURE_SUGGESTION_TERMS_BY_LENGTH_DESC = [...ADVENTURE_SUGGESTION_TERMS].sort(
  (left, right) => right.length - left.length,
);

function normalizeText(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeAdventureTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  for (const term of ADVENTURE_SUGGESTION_TERMS_BY_LENGTH_DESC) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableAdventureTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of ADVENTURE_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return ADVENTURE_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
