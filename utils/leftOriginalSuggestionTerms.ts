type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const LEFT_ORIGINAL_SUGGESTION_TERMS: string[] = [
  'ຊ້າຍເດີມ',
  'ຊ້າຍເດິມ',
  'ຊາຍເດີມ',
  'ຊາຍເດິມ',
  'ຊາຍເດມ',
  'ຊ້າຍເດມ',
  'ຊ້ວຍເດີມ',
  'ຊ້ວຍເດິມ',
  'ຊ້ວຍເດມ',
  'ຊວຍເດີມ',
  'ຊວຍເດິມ',
  'ຊວຍເດມ',
];

function normalizeText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeLeftOriginalTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  for (const term of LEFT_ORIGINAL_SUGGESTION_TERMS) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableLeftOriginalTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of LEFT_ORIGINAL_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return LEFT_ORIGINAL_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
