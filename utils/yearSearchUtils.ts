/**
 * Utility functions for year-based car search
 * Handles extraction, suggestions, and ranking by year
 */

const YEAR_REGEX = /\b(19|20)\d{2}\b/g;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_CAR_YEAR = 1980;
const MAX_CAR_YEAR = CURRENT_YEAR + 2; // Allow 2 years ahead for future models

/**
 * Extract years from a search query string
 * @param query - Search query (e.g., "vigo 2010")
 * @returns Array of valid car years found
 */
export function extractYearsFromQuery(query: string): number[] {
  const matches = query.match(YEAR_REGEX);
  if (!matches) return [];

  const years = matches
    .map((y) => parseInt(y, 10))
    .filter((year) => year >= MIN_CAR_YEAR && year <= MAX_CAR_YEAR)
    .filter((year, index, arr) => arr.indexOf(year) === index); // Remove duplicates

  return years.sort((a, b) => a - b);
}

/**
 * Remove year from query to get the base model name
 * @param query - Search query
 * @returns Query without years
 */
export function removeYearsFromQuery(query: string): string {
  return query
    .replace(YEAR_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate year suggestions based on model name
 * Looks at posts with this model and extracts available years
 * @param modelSearchTerms - Search terms for the model
 * @param posts - Array of posts to scan for available years
 * @returns Sorted array of available years
 */
export function generateYearSuggestions(
  modelSearchTerms: string[],
  posts: Array<any>
): number[] {
  const yearsSet = new Set<number>();

  const modelSearchNormalized = modelSearchTerms
    .map((term) => String(term ?? '').toLowerCase().trim())
    .filter(Boolean);

  for (const post of posts) {
    const caption = String(post.caption ?? '').toLowerCase();

    // Check if caption matches any of the model search terms
    const matchesModel = modelSearchNormalized.some((term) => caption.includes(term));

    if (matchesModel) {
      // Extract years from this post's caption
      const captionYears = extractYearsFromQuery(post.caption);
      for (const year of captionYears) {
        yearsSet.add(year);
      }
    }
  }

  // Return sorted years in descending order (newest first)
  return Array.from(yearsSet).sort((a, b) => b - a);
}

/**
 * Rank/sort posts by how well they match the year in the query
 * @param posts - Array of posts to sort
 * @param queryYears - Years from the search query
 * @returns Sorted posts: exact year matches first, then partial matches, then others
 */
export function rankPostsByYear(
  posts: Array<any>,
  queryYears: number[]
): Array<any> {
  if (queryYears.length === 0) return posts;

  const primary: typeof posts = []; // Exact year match
  const secondary: typeof posts = []; // Has year but doesn't match
  const tertiary: typeof posts = []; // No year

  const queryYearsSet = new Set(queryYears);

  for (const post of posts) {
    const postYears = extractYearsFromQuery(post.caption);

    // Check if any query year matches any post year
    const hasExactMatch = postYears.some((y) => queryYearsSet.has(y));

    if (hasExactMatch) {
      primary.push(post);
    } else if (postYears.length > 0) {
      secondary.push(post);
    } else {
      tertiary.push(post);
    }
  }

  return [...primary, ...secondary, ...tertiary];
}

/**
 * Format year suggestion text (e.g., "vigo 2010")
 * @param modelName - Display name of the model
 * @param year - Year
 * @returns Formatted suggestion
 */
export function formatYearSuggestion(modelName: string, year: number): string {
  return `${modelName} ${year}`;
}

/**
 * Extract model name from query (removes year)
 * @param query - Search query
 * @returns Model name without year
 */
export function getModelNameFromQuery(query: string): string {
  return removeYearsFromQuery(query).trim();
}
