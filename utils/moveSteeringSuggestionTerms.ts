type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const MOVE_STEERING_SUGGESTION_TERMS: string[] = [
  'ຍ້າຍພວງ',
  'ຍາຍພວງ',
  'ຍ້າຍພ່ວງ',
  'ຍາຍພ່ວງ',
  'ຍ້າຍພ້ວງ',
  'ຍາຍພ້ວງ',
];

function normalizeText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeMoveSteeringTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  for (const term of MOVE_STEERING_SUGGESTION_TERMS) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableMoveSteeringTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of MOVE_STEERING_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return MOVE_STEERING_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
