type CaptionLike = { caption?: unknown };

// Keep this list in display order. Any query that matches one term is treated as the same group.
export const FULL_OPTION_SUGGESTION_TERMS: string[] = [
  'ອັອບຊັ້ນເຕັມ',
  'ອ໊ອບຊັ້ນເຕັມ',
  'ອອບຊັນເຕັມ',
  'ອັອບຊັ່ນເຕັມ',
  'ອັອບຊັ້ນເຕັ່ມ',
  'ອ້ອບຊັ້ນເຕັມ',
  'ອອບຊັ່ນເຕັມ',
  'ອອບຊັ້ນເຕັມ',
  'ອອັບຊັ່ນເຕັມ',
  'ອອັບຊັ້ນເຕັມ',
  'ອ໊ອບຊັ່ນເຕັມ',
  'ອ໋ອບຊັ້ນເຕັມ',
  'ອ໋ອບຊັ່ນເຕັມ',
  'ຟູອ໋ອບຊັ້ນ',
  'ຟູອັອບຊັ້ນ',
  'full option',
  'fulloption',
  'ອອບຊັ້ນ:ເຕັ້ມ',
  'ອອບຊັ້ນເຕັ້ມ',
  'ອັອບຊັນເຕັມ',
  'ແອັບຊັ້ນເຕັມ',
  'ແອັບຊັນເຕັມ',
  'ແອັບຊັ່ນເຕັມ',
  'ອ໋ອບຊັ້ນໂຕ',
  'ອ່ອບຊັນເຕັມ',
  'ອ່ອບຊັ້ນເຕັມ',
  'ອ່ອບຊັ່ນເຕັມ',
  'ອ໋ອບຊັນເຕັມ',
  'ອອບຊັນ ເຕັມ',
];

const FULL_OPTION_SUGGESTION_TERMS_BY_LENGTH_DESC = [...FULL_OPTION_SUGGESTION_TERMS].sort(
  (left, right) => right.length - left.length,
);

function normalizeText(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeFullOptionTermsFromQuery(query: string): string {
  const normalized = normalizeText(query);
  if (!normalized) return '';

  let output = normalized;
  for (const term of FULL_OPTION_SUGGESTION_TERMS_BY_LENGTH_DESC) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    output = output.replaceAll(termNorm, ' ');
  }

  return output.replace(/\s+/g, ' ').trim();
}

export function collectAvailableFullOptionTerms(posts: CaptionLike[]): string[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const matchedTerms = new Set<string>();

  for (const post of posts) {
    const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
    if (!caption) continue;

    for (const term of FULL_OPTION_SUGGESTION_TERMS) {
      if (caption.includes(normalizeText(term))) {
        matchedTerms.add(term);
      }
    }
  }

  // Preserve original configured order for stable UX.
  return FULL_OPTION_SUGGESTION_TERMS.filter((term) => matchedTerms.has(term));
}
