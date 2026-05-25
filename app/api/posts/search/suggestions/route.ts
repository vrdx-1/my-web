import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';
import { expandWithoutBrandAliases, captionMatchesAnyAlias, getCanonicalModelDisplayName } from '@/utils/postUtils';
import { generateYearSuggestions, getModelNameFromQuery, formatYearSuggestion, extractYearsFromQuery, extractPartialYearPrefix } from '@/utils/yearSearchUtils';
import { collectAvailableSmartCabTerms, removeSmartCabTermsFromQuery } from '@/utils/smartCabSuggestionTerms';
import { collectAvailableLeftOriginalTerms, removeLeftOriginalTermsFromQuery } from '@/utils/leftOriginalSuggestionTerms';
import { collectAvailableMoveSteeringTerms, removeMoveSteeringTermsFromQuery } from '@/utils/moveSteeringSuggestionTerms';
import { collectAvailableLaoCenterTerms, removeLaoCenterTermsFromQuery } from '@/utils/laoCenterSuggestionTerms';
import { collectAvailableChampTerms, removeChampTermsFromQuery } from '@/utils/champSuggestionTerms';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

const SUGGESTION_LIMIT = 300;
const DEFAULT_SUGGESTIONS_PAGE_SIZE = 200;
const MAX_SUGGESTIONS_PAGE_SIZE = 400;
const MAX_SUGGESTIONS_POOL = 1200;

function normalizeText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function postHasTerm(post: { caption?: unknown }, term: string): boolean {
  const caption = normalizeText(typeof post?.caption === 'string' ? post.caption : '');
  if (!caption) return false;
  return caption.includes(normalizeText(term));
}

function postHasYear(post: { caption?: unknown }, year: number): boolean {
  const caption = typeof post?.caption === 'string' ? post.caption : '';
  if (!caption) return false;
  return extractYearsFromQuery(caption).includes(year);
}

function collectYearsForTerm(posts: Array<{ caption?: unknown }>, term: string, years: number[]): number[] {
  if (!term || years.length === 0) return [];
  return years.filter((year) => posts.some((post) => postHasTerm(post, term) && postHasYear(post, year)));
}

function hasCombinedTermInAnyPost(
  posts: Array<{ caption?: unknown }>,
  firstTerm: string,
  secondTerm: string,
  year?: number,
): boolean {
  return posts.some((post) => {
    if (!postHasTerm(post, firstTerm) || !postHasTerm(post, secondTerm)) return false;
    if (year == null) return true;
    return postHasYear(post, year);
  });
}

function hasAllTermsInAnyPost(
  posts: Array<{ caption?: unknown }>,
  terms: string[],
  year?: number,
): boolean {
  const cleanTerms = terms.map((term) => String(term ?? '').trim()).filter(Boolean);
  if (cleanTerms.length === 0) return false;

  return posts.some((post) => {
    for (const term of cleanTerms) {
      if (!postHasTerm(post, term)) return false;
    }
    if (year == null) return true;
    return postHasYear(post, year);
  });
}

function firstIndexOfAnyTerm(text: string, terms: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const term of terms) {
    const idx = text.indexOf(normalizeText(term));
    if (idx >= 0 && idx < best) best = idx;
  }
  return Number.isFinite(best) ? best : -1;
}

function formatCombinedSuggestion(
  canonicalName: string,
  queryNormalized: string,
  terms: string[],
  year?: number,
): string {
  const ordered = [...terms].sort((left, right) => {
    const leftIndex = queryNormalized.indexOf(normalizeText(left));
    const rightIndex = queryNormalized.indexOf(normalizeText(right));
    const leftFound = leftIndex >= 0;
    const rightFound = rightIndex >= 0;

    if (leftFound && rightFound) return leftIndex - rightIndex;
    if (leftFound) return -1;
    if (rightFound) return 1;
    return 0;
  });

  if (year == null) return `${canonicalName} ${ordered.join(' ')}`;
  return `${canonicalName} ${ordered.join(' ')} ${year}`;
}

/**
 * GET /api/posts/search/suggestions?q=...
 * Returns model suggestions with available years
 * Example: q="vigo" -> ["vigo 2010", "vigo 2011", ...]
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await checkRateLimit({
      namespace: 'posts:search-suggestions',
      identifier: ip,
      limit: 90,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return tooManyRequests(rateLimit.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') ?? '';
    const query = (typeof q === 'string' ? q : '').trim();

    const pageRaw = Number(searchParams.get('page') ?? '1');
    const pageSizeRaw = Number(searchParams.get('pageSize') ?? String(DEFAULT_SUGGESTIONS_PAGE_SIZE));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), MAX_SUGGESTIONS_PAGE_SIZE)
      : DEFAULT_SUGGESTIONS_PAGE_SIZE;

    if (query.length === 0) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    // Extract base model name (without year / grouped suffix terms)
    const queryWithoutSmartCab = removeSmartCabTermsFromQuery(query);
    const queryWithoutLeftOriginalTerms = removeLeftOriginalTermsFromQuery(queryWithoutSmartCab);
    const queryWithoutMoveSteeringTerms = removeMoveSteeringTermsFromQuery(queryWithoutLeftOriginalTerms);
    const queryWithoutLaoCenterTerms = removeLaoCenterTermsFromQuery(queryWithoutMoveSteeringTerms);
    const queryWithoutFeatureTerms = removeChampTermsFromQuery(queryWithoutLaoCenterTerms);
    const baseQuery = getModelNameFromQuery(queryWithoutFeatureTerms);
    const queryYears = extractYearsFromQuery(query);

    let modelQueryForSuggestions = baseQuery;

    // Fallback for smooth typing when users append digits directly after model name,
    // e.g. "revo2" / "revo 2". We keep the model part for matching and treat trailing
    // digits as year-prefix filter so suggestions do not disappear and reappear.
    const trailingDigitsMatch = baseQuery.match(/^(.*?)(\d{1,4})$/);
    const trailingModelPart = trailingDigitsMatch?.[1]?.trim() ?? '';
    const trailingDigitsPrefix = trailingDigitsMatch?.[2] ?? null;

    // Only show year suggestions when the query resolves to a canonical model name that
    // starts with the typed query — prevents "vi" from showing "vi 2015" (which resolves
    // to Phantom VI / Mark VI, not a meaningful suggestion for the user).
    let canonicalName = getCanonicalModelDisplayName(modelQueryForSuggestions);
    if (!canonicalName && trailingModelPart && trailingDigitsPrefix) {
      const fallbackCanonical = getCanonicalModelDisplayName(trailingModelPart);
      if (fallbackCanonical) {
        canonicalName = fallbackCanonical;
        modelQueryForSuggestions = trailingModelPart;
      }
    }
    if (!canonicalName) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    // Expand search terms using the resolved model query
    const terms = expandWithoutBrandAliases(modelQueryForSuggestions)
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Load latest visible posts, then filter by alias match to avoid depending on contiguous phrase order in caption.
    const { data: posts, error } = await supabase
      .from('cars')
      .select(POST_WITH_PROFILE_SELECT)
      .in('status', ['recommend', 'sold'])
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(SUGGESTION_LIMIT);

    if (error) {
      return internalServerError('posts/search/suggestions list cars failed', error);
    }

    const hydratedPosts = await attachEffectiveWhatsAppPhones(supabase, (posts || []) as Record<string, unknown>[]);

    const matchedPosts = hydratedPosts.filter((post) => {
      const caption = typeof (post as { caption?: unknown })?.caption === 'string'
        ? (post as { caption: string }).caption
        : '';
      return captionMatchesAnyAlias(caption, terms);
    });
    const availableYears = generateYearSuggestions(terms, matchedPosts);

    // Filter by full year match OR partial year prefix (e.g. "revo20" → show years starting with "20")
    const partialPrefix = extractPartialYearPrefix(queryWithoutFeatureTerms) ?? trailingDigitsPrefix;
    const yearsForSuggestions = queryYears.length > 0
      ? availableYears.filter((year) => queryYears.includes(year))
      : partialPrefix
        ? availableYears.filter((year) => String(year).startsWith(partialPrefix))
        : availableYears;

    // Show all Smart Cab keyword variants in this group when they exist in matched captions.
    const availableSmartCabTerms = collectAvailableSmartCabTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableLeftOriginalTerms = collectAvailableLeftOriginalTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableMoveSteeringTerms = collectAvailableMoveSteeringTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableLaoCenterTerms = collectAvailableLaoCenterTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableChampTerms = collectAvailableChampTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );

    const queryNormalized = normalizeText(query);
    const smartCabFirstIndex = firstIndexOfAnyTerm(queryNormalized, availableSmartCabTerms);
    const leftOriginalFirstIndex = firstIndexOfAnyTerm(queryNormalized, availableLeftOriginalTerms);
    const preferSmartCabBeforeLeft =
      smartCabFirstIndex >= 0 && leftOriginalFirstIndex >= 0
        ? smartCabFirstIndex < leftOriginalFirstIndex
        : false;

    const prefersNoSpaceSmartCab = /\s/.test(query) === false;
    const smartCabSuggestions = availableSmartCabTerms.flatMap((term) => {
      const noSpace = `${canonicalName}${term}`;
      const withSpace = `${canonicalName} ${term}`;
      return prefersNoSpaceSmartCab ? [noSpace, withSpace] : [withSpace, noSpace];
    });

    const smartCabYearSuggestions = availableSmartCabTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.flatMap((year) => {
        const noSpace = `${canonicalName}${term}${year}`;
        const withSpace = `${canonicalName} ${term} ${year}`;
        return prefersNoSpaceSmartCab ? [noSpace, withSpace] : [withSpace, noSpace];
      });
    });

    const leftOriginalSuggestions = availableLeftOriginalTerms.map((term) => `${canonicalName} ${term}`);

    const leftOriginalYearSuggestions = availableLeftOriginalTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const moveSteeringSuggestions = availableMoveSteeringTerms.map((term) => `${canonicalName} ${term}`);

    const moveSteeringYearSuggestions = availableMoveSteeringTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const laoCenterSuggestions = availableLaoCenterTerms.map((term) => `${canonicalName} ${term}`);

    const laoCenterYearSuggestions = availableLaoCenterTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const champSuggestions = availableChampTerms.map((term) => `${canonicalName} ${term}`);

    const champYearSuggestions = availableChampTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const mixedTermSuggestions = availableLeftOriginalTerms.flatMap((leftTerm) =>
      availableSmartCabTerms
        .filter((smartTerm) =>
          hasCombinedTermInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            leftTerm,
            smartTerm,
          ),
        )
        .map((smartTerm) =>
          preferSmartCabBeforeLeft
            ? `${canonicalName} ${smartTerm} ${leftTerm}`
            : `${canonicalName} ${leftTerm} ${smartTerm}`,
        )
    );

    const mixedTermYearSuggestions = availableLeftOriginalTerms.flatMap((leftTerm) =>
      availableSmartCabTerms.flatMap((smartTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasCombinedTermInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              leftTerm,
              smartTerm,
              year,
            ),
          )
          .map((year) =>
            preferSmartCabBeforeLeft
              ? `${canonicalName} ${smartTerm} ${leftTerm} ${year}`
              : `${canonicalName} ${leftTerm} ${smartTerm} ${year}`,
          )
      )
    );

    const mixedMoveAndSmartSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableSmartCabTerms
        .filter((smartTerm) =>
          hasAllTermsInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            [moveTerm, smartTerm],
          ),
        )
        .map((smartTerm) => `${canonicalName} ${moveTerm} ${smartTerm}`)
    );

    const mixedMoveAndSmartYearSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableSmartCabTerms.flatMap((smartTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [moveTerm, smartTerm],
              year,
            ),
          )
          .map((year) => `${canonicalName} ${moveTerm} ${smartTerm} ${year}`)
      )
    );

    const mixedMoveAndLeftSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableLeftOriginalTerms
        .filter((leftTerm) =>
          hasAllTermsInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            [moveTerm, leftTerm],
          ),
        )
        .map((leftTerm) => `${canonicalName} ${moveTerm} ${leftTerm}`)
    );

    const mixedMoveAndLeftYearSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [moveTerm, leftTerm],
              year,
            ),
          )
          .map((year) => `${canonicalName} ${moveTerm} ${leftTerm} ${year}`)
      )
    );

    const mixedAllThreeSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        availableSmartCabTerms
          .filter((smartTerm) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [moveTerm, leftTerm, smartTerm],
            ),
          )
          .map((smartTerm) => `${canonicalName} ${moveTerm} ${leftTerm} ${smartTerm}`)
      )
    );

    const mixedAllThreeYearSuggestions = availableMoveSteeringTerms.flatMap((moveTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        availableSmartCabTerms.flatMap((smartTerm) =>
          yearsForSuggestions
            .filter((year) =>
              hasAllTermsInAnyPost(
                matchedPosts as Array<{ caption?: unknown }>,
                [moveTerm, leftTerm, smartTerm],
                year,
              ),
            )
            .map((year) => `${canonicalName} ${moveTerm} ${leftTerm} ${smartTerm} ${year}`)
        )
      )
    );

    const mixedCenterAndSmartSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableSmartCabTerms
        .filter((smartTerm) =>
          hasAllTermsInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            [centerTerm, smartTerm],
          ),
        )
        .map((smartTerm) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, smartTerm]))
    );

    const mixedCenterAndSmartYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableSmartCabTerms.flatMap((smartTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, smartTerm],
              year,
            ),
          )
          .map((year) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, smartTerm], year))
      )
    );

    const mixedCenterAndLeftSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableLeftOriginalTerms
        .filter((leftTerm) =>
          hasAllTermsInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            [centerTerm, leftTerm],
          ),
        )
        .map((leftTerm) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, leftTerm]))
    );

    const mixedCenterAndLeftYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, leftTerm],
              year,
            ),
          )
          .map((year) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, leftTerm], year))
      )
    );

    const mixedCenterAndMoveSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms
        .filter((moveTerm) =>
          hasAllTermsInAnyPost(
            matchedPosts as Array<{ caption?: unknown }>,
            [centerTerm, moveTerm],
          ),
        )
        .map((moveTerm) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm]))
    );

    const mixedCenterAndMoveYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        yearsForSuggestions
          .filter((year) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, moveTerm],
              year,
            ),
          )
          .map((year) => formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm], year))
      )
    );

    const mixedCenterLeftSmartSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        availableSmartCabTerms
          .filter((smartTerm) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, leftTerm, smartTerm],
            ),
          )
          .map((smartTerm) =>
            formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, leftTerm, smartTerm])
          )
      )
    );

    const mixedCenterLeftSmartYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableLeftOriginalTerms.flatMap((leftTerm) =>
        availableSmartCabTerms.flatMap((smartTerm) =>
          yearsForSuggestions
            .filter((year) =>
              hasAllTermsInAnyPost(
                matchedPosts as Array<{ caption?: unknown }>,
                [centerTerm, leftTerm, smartTerm],
                year,
              ),
            )
            .map((year) =>
              formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, leftTerm, smartTerm], year)
            )
        )
      )
    );

    const mixedCenterMoveSmartSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableSmartCabTerms
          .filter((smartTerm) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, moveTerm, smartTerm],
            ),
          )
          .map((smartTerm) =>
            formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, smartTerm])
          )
      )
    );

    const mixedCenterMoveSmartYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableSmartCabTerms.flatMap((smartTerm) =>
          yearsForSuggestions
            .filter((year) =>
              hasAllTermsInAnyPost(
                matchedPosts as Array<{ caption?: unknown }>,
                [centerTerm, moveTerm, smartTerm],
                year,
              ),
            )
            .map((year) =>
              formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, smartTerm], year)
            )
        )
      )
    );

    const mixedCenterMoveLeftSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableLeftOriginalTerms
          .filter((leftTerm) =>
            hasAllTermsInAnyPost(
              matchedPosts as Array<{ caption?: unknown }>,
              [centerTerm, moveTerm, leftTerm],
            ),
          )
          .map((leftTerm) =>
            formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, leftTerm])
          )
      )
    );

    const mixedCenterMoveLeftYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableLeftOriginalTerms.flatMap((leftTerm) =>
          yearsForSuggestions
            .filter((year) =>
              hasAllTermsInAnyPost(
                matchedPosts as Array<{ caption?: unknown }>,
                [centerTerm, moveTerm, leftTerm],
                year,
              ),
            )
            .map((year) =>
              formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, leftTerm], year)
            )
        )
      )
    );

    const mixedAllFourSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableLeftOriginalTerms.flatMap((leftTerm) =>
          availableSmartCabTerms
            .filter((smartTerm) =>
              hasAllTermsInAnyPost(
                matchedPosts as Array<{ caption?: unknown }>,
                [centerTerm, moveTerm, leftTerm, smartTerm],
              ),
            )
            .map((smartTerm) =>
              formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, leftTerm, smartTerm])
            )
        )
      )
    );

    const mixedAllFourYearSuggestions = availableLaoCenterTerms.flatMap((centerTerm) =>
      availableMoveSteeringTerms.flatMap((moveTerm) =>
        availableLeftOriginalTerms.flatMap((leftTerm) =>
          availableSmartCabTerms.flatMap((smartTerm) =>
            yearsForSuggestions
              .filter((year) =>
                hasAllTermsInAnyPost(
                  matchedPosts as Array<{ caption?: unknown }>,
                  [centerTerm, moveTerm, leftTerm, smartTerm],
                  year,
                ),
              )
              .map((year) =>
                formatCombinedSuggestion(canonicalName, queryNormalized, [centerTerm, moveTerm, leftTerm, smartTerm], year)
              )
          )
        )
      )
    );

    const extraFeatureGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
    ].filter((group) => group.length > 0);

    const champMixedSuggestions: string[] = [];
    const champMixedYearSuggestions: string[] = [];
    const canonicalForMixed = canonicalName as string;

    function collectSubsets(start: number, current: string[][]) {
      if (current.length > 0) {
        const termLists = [availableChampTerms, ...current];
        const stack: string[][] = [[]];
        for (const list of termLists) {
          const next: string[][] = [];
          for (const base of stack) {
            for (const term of list) {
              next.push([...base, term]);
            }
          }
          stack.splice(0, stack.length, ...next);
        }

        for (const termsCombo of stack) {
          if (!hasAllTermsInAnyPost(matchedPosts as Array<{ caption?: unknown }>, termsCombo)) continue;
          champMixedSuggestions.push(formatCombinedSuggestion(canonicalForMixed, queryNormalized, termsCombo));
          for (const year of yearsForSuggestions) {
            if (!hasAllTermsInAnyPost(matchedPosts as Array<{ caption?: unknown }>, termsCombo, year)) continue;
            champMixedYearSuggestions.push(formatCombinedSuggestion(canonicalForMixed, queryNormalized, termsCombo, year));
          }
        }
      }

      for (let index = start; index < extraFeatureGroups.length; index += 1) {
        current.push(extraFeatureGroups[index]);
        collectSubsets(index + 1, current);
        current.pop();
      }
    }

    if (availableChampTerms.length > 0) {
      collectSubsets(0, []);
    }

    // Order: base model/brand first, then year suggestions, then grouped feature suggestions.
      const allSuggestions = [
      canonicalName,
      ...yearsForSuggestions.map((year) => formatYearSuggestion(canonicalName, year)),
      ...champSuggestions,
      ...champYearSuggestions,
      ...smartCabSuggestions,
      ...smartCabYearSuggestions,
      ...leftOriginalSuggestions,
      ...leftOriginalYearSuggestions,
      ...moveSteeringSuggestions,
      ...moveSteeringYearSuggestions,
      ...laoCenterSuggestions,
      ...laoCenterYearSuggestions,
      ...champMixedSuggestions,
      ...champMixedYearSuggestions,
      ...mixedTermSuggestions,
      ...mixedTermYearSuggestions,
      ...mixedMoveAndSmartSuggestions,
      ...mixedMoveAndSmartYearSuggestions,
      ...mixedMoveAndLeftSuggestions,
      ...mixedMoveAndLeftYearSuggestions,
      ...mixedAllThreeSuggestions,
      ...mixedAllThreeYearSuggestions,
      ...mixedCenterAndSmartSuggestions,
      ...mixedCenterAndSmartYearSuggestions,
      ...mixedCenterAndLeftSuggestions,
      ...mixedCenterAndLeftYearSuggestions,
      ...mixedCenterAndMoveSuggestions,
      ...mixedCenterAndMoveYearSuggestions,
      ...mixedCenterLeftSmartSuggestions,
      ...mixedCenterLeftSmartYearSuggestions,
      ...mixedCenterMoveSmartSuggestions,
      ...mixedCenterMoveSmartYearSuggestions,
      ...mixedCenterMoveLeftSuggestions,
      ...mixedCenterMoveLeftYearSuggestions,
      ...mixedAllFourSuggestions,
      ...mixedAllFourYearSuggestions,
    ].filter((item, index, arr) => arr.indexOf(item) === index)
        .slice(0, MAX_SUGGESTIONS_POOL);

      const offset = (page - 1) * pageSize;
      const suggestions = allSuggestions.slice(offset, offset + pageSize);
      const hasMore = offset + pageSize < allSuggestions.length;

    return NextResponse.json(
        {
          suggestions,
          pagination: {
            page,
            pageSize,
            total: allSuggestions.length,
            hasMore,
            nextPage: hasMore ? page + 1 : null,
          },
        },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    return internalServerError('posts/search/suggestions unexpected error', error);
  }
}
