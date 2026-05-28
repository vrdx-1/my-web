import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';
import { expandWithoutBrandAliases, captionMatchesAnyAlias, getCanonicalModelDisplayName } from '@/utils/postUtils';
import { generateYearSuggestions, getModelNameFromQuery, formatYearSuggestion, extractYearsFromQuery, extractPartialYearPrefix } from '@/utils/yearSearchUtils';
import { collectAvailableSmartCabTerms, removeSmartCabTermsFromQuery, SMART_CAB_SUGGESTION_TERMS } from '@/utils/smartCabSuggestionTerms';
import { collectAvailableLeftOriginalTerms, removeLeftOriginalTermsFromQuery } from '@/utils/leftOriginalSuggestionTerms';
import { collectAvailableMoveSteeringTerms, removeMoveSteeringTermsFromQuery } from '@/utils/moveSteeringSuggestionTerms';
import { collectAvailableLaoCenterTerms, removeLaoCenterTermsFromQuery } from '@/utils/laoCenterSuggestionTerms';
import { collectAvailableChampTerms, removeChampTermsFromQuery } from '@/utils/champSuggestionTerms';
import { collectAvailableRoccoTerms, removeRoccoTermsFromQuery } from '@/utils/roccoSuggestionTerms';
import { collectAvailableVxlTerms, removeVxlTermsFromQuery } from '@/utils/vxlSuggestionTerms';
import { collectAvailableVxrTerms, removeVxrTermsFromQuery } from '@/utils/vxrSuggestionTerms';
import { collectAvailableTeiyTerms, removeTeiyTermsFromQuery } from '@/utils/teiySuggestionTerms';
import { collectAvailableLegenderTerms, removeLegenderTermsFromQuery } from '@/utils/legenderSuggestionTerms';
import { collectAvailableKapukTerms, removeKapukTermsFromQuery } from '@/utils/kapukSuggestionTerms';
import { collectAvailableAutoTerms, removeAutoTermsFromQuery } from '@/utils/autoSuggestionTerms';
import { collectAvailablePhovinTerms, removePhovinTermsFromQuery } from '@/utils/phovinSuggestionTerms';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

const SUGGESTION_LIMIT = 300;
const DEFAULT_SUGGESTIONS_PAGE_SIZE = 200;
const MAX_SUGGESTIONS_PAGE_SIZE = 400;
const MAX_SUGGESTIONS_POOL = 1200;

function normalizeText(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactNormalizedText(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

function addMixedScriptWordBoundaries(value: string): string {
  return String(value ?? '')
    .replace(/([a-zA-Z0-9])([\u0E00-\u0EFF])/g, '$1 $2')
    .replace(/([\u0E00-\u0EFF])([a-zA-Z0-9])/g, '$1 $2')
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

function extractFeatureQueryFragments(query: string, canonicalName: string): string[] {
  const fragments: string[] = [];
  const queryNormalized = normalizeText(query);
  const canonicalNormalized = normalizeText(canonicalName);

  if (queryNormalized.startsWith(canonicalNormalized)) {
    const suffix = queryNormalized.slice(canonicalNormalized.length).trim();
    if (suffix) {
      fragments.push(suffix);
      for (const part of suffix.split(' ')) {
        const token = part.trim();
        if (token) fragments.push(token);
      }
    }
  }

  const queryCompact = compactNormalizedText(query);
  const canonicalCompact = compactNormalizedText(canonicalName);
  if (queryCompact.startsWith(canonicalCompact)) {
    const compactSuffix = queryCompact.slice(canonicalCompact.length).trim();
    if (compactSuffix) fragments.push(compactSuffix);
  }

  return Array.from(new Set(fragments.filter(Boolean)));
}

function scoreSuggestionByTypedIntent(
  suggestion: string,
  canonicalName: string,
  featureQueryFragments: string[],
  availableFeatureTerms: string[],
  preferredFeatureTerms: string[],
): number {
  if (suggestion === canonicalName) return 1_000_000;
  if (featureQueryFragments.length === 0) return 0;

  const suggestionNormalized = normalizeText(suggestion);
  const suggestionCompact = compactNormalizedText(suggestion);
  const canonicalNormalized = normalizeText(canonicalName);
  const canonicalCompact = compactNormalizedText(canonicalName);

  const suggestionFeatureNormalized = suggestionNormalized.startsWith(canonicalNormalized)
    ? suggestionNormalized.slice(canonicalNormalized.length).trim()
    : suggestionNormalized;
  const suggestionFeatureCompact = suggestionCompact.startsWith(canonicalCompact)
    ? suggestionCompact.slice(canonicalCompact.length).trim()
    : suggestionCompact;

  let score = 0;

  for (const fragment of featureQueryFragments) {
    const fragmentNormalized = normalizeText(fragment);
    const fragmentCompact = compactNormalizedText(fragment);
    if (!fragmentNormalized && !fragmentCompact) continue;

    const startsWithFragment =
      (!!fragmentNormalized && suggestionFeatureNormalized.startsWith(fragmentNormalized))
      || (!!fragmentCompact && suggestionFeatureCompact.startsWith(fragmentCompact));
    const containsFragment =
      (!!fragmentNormalized && suggestionFeatureNormalized.includes(fragmentNormalized))
      || (!!fragmentCompact && suggestionFeatureCompact.includes(fragmentCompact));

    if (startsWithFragment) {
      score += 180;
    } else if (containsFragment) {
      score += 80;
    }

    for (const term of availableFeatureTerms) {
      const termNormalized = normalizeText(term);
      const termCompact = compactNormalizedText(term);
      if (!termNormalized && !termCompact) continue;

      const fragmentMatchesTermPrefix =
        (!!fragmentNormalized && termNormalized.startsWith(fragmentNormalized))
        || (!!fragmentCompact && termCompact.startsWith(fragmentCompact));

      if (!fragmentMatchesTermPrefix) continue;

      const suggestionHasTerm =
        (!!termNormalized && suggestionFeatureNormalized.includes(termNormalized))
        || (!!termCompact && suggestionFeatureCompact.includes(termCompact));

      if (suggestionHasTerm) {
        score += 320;
      } else {
        score += 40;
      }
    }
  }

  // When user types a known feature-group term, surface sibling aliases from the same
  // group earlier (e.g. smart cab variants) without changing search matching behavior.
  for (const preferredTerm of preferredFeatureTerms) {
    const preferredNormalized = normalizeText(preferredTerm);
    const preferredCompact = compactNormalizedText(preferredTerm);
    if (!preferredNormalized && !preferredCompact) continue;

    const suggestionHasPreferredTerm =
      (!!preferredNormalized && suggestionFeatureNormalized.includes(preferredNormalized))
      || (!!preferredCompact && suggestionFeatureCompact.includes(preferredCompact));

    if (suggestionHasPreferredTerm) {
      score += 520;
      break;
    }
  }

  return score;
}

function scoreSuggestionByActiveGroupTerms(
  suggestion: string,
  canonicalName: string,
  activeGroupTerms: string[],
): number {
  if (activeGroupTerms.length === 0) return 0;
  if (suggestion === canonicalName) return 0;

  const suggestionNormalized = normalizeText(suggestion);
  const suggestionCompact = compactNormalizedText(suggestion);
  const canonicalNormalized = normalizeText(canonicalName);
  const canonicalCompact = compactNormalizedText(canonicalName);

  const suggestionFeatureNormalized = suggestionNormalized.startsWith(canonicalNormalized)
    ? suggestionNormalized.slice(canonicalNormalized.length).trim()
    : suggestionNormalized;
  const suggestionFeatureCompact = suggestionCompact.startsWith(canonicalCompact)
    ? suggestionCompact.slice(canonicalCompact.length).trim()
    : suggestionCompact;

  let score = 0;
  for (const term of activeGroupTerms) {
    const termNormalized = normalizeText(term);
    const termCompact = compactNormalizedText(term);
    if (!termNormalized && !termCompact) continue;

    const suggestionHasTerm =
      (!!termNormalized && suggestionFeatureNormalized.includes(termNormalized))
      || (!!termCompact && suggestionFeatureCompact.includes(termCompact));

    if (suggestionHasTerm) {
      score += 900;
    }
  }

  return score;
}

function queryContainsTerm(query: string, term: string): boolean {
  const queryNormalized = normalizeText(query);
  const queryCompact = compactNormalizedText(query);
  const termNormalized = normalizeText(term);
  const termCompact = compactNormalizedText(term);

  if (!queryNormalized && !queryCompact) return false;
  if (!termNormalized && !termCompact) return false;

  return (
    (!!termNormalized && queryNormalized.includes(termNormalized))
    || (!!termCompact && queryCompact.includes(termCompact))
  );
}

function isYearOnlySuggestion(suggestion: string, canonicalName: string): boolean {
  const normalized = normalizeText(suggestion);
  const canonical = normalizeText(canonicalName);
  if (!normalized || !canonical) return false;
  if (!normalized.startsWith(canonical)) return false;

  const rest = normalized.slice(canonical.length).trim();
  return /^\d{4}$/.test(rest);
}

function hasFeatureLikeQueryFragment(fragments: string[]): boolean {
  return fragments.some((fragment) => /[a-zA-Z\u0E00-\u0EFF]/u.test(fragment));
}

function buildMixedSuggestionsForGroup(
  canonicalName: string,
  queryNormalized: string,
  matchedPosts: Array<{ caption?: unknown }>,
  yearsForSuggestions: number[],
  primaryTerms: string[],
  companionGroups: string[][],
): { mixedSuggestions: string[]; mixedYearSuggestions: string[] } {
  const mixedSuggestions: string[] = [];
  const mixedYearSuggestions: string[] = [];

  if (primaryTerms.length === 0 || companionGroups.length === 0) {
    return { mixedSuggestions, mixedYearSuggestions };
  }

  function walkCompanions(start: number, selected: string[][]) {
    if (selected.length > 0) {
      const termLists = [primaryTerms, ...selected];
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
        if (!hasAllTermsInAnyPost(matchedPosts, termsCombo)) continue;
        mixedSuggestions.push(formatCombinedSuggestion(canonicalName, queryNormalized, termsCombo));

        for (const year of yearsForSuggestions) {
          if (!hasAllTermsInAnyPost(matchedPosts, termsCombo, year)) continue;
          mixedYearSuggestions.push(formatCombinedSuggestion(canonicalName, queryNormalized, termsCombo, year));
        }
      }
    }

    for (let index = start; index < companionGroups.length; index += 1) {
      selected.push(companionGroups[index]);
      walkCompanions(index + 1, selected);
      selected.pop();
    }
  }

  walkCompanions(0, []);

  return {
    mixedSuggestions: Array.from(new Set(mixedSuggestions)),
    mixedYearSuggestions: Array.from(new Set(mixedYearSuggestions)),
  };
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
    const queryWithBoundaries = addMixedScriptWordBoundaries(query);

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
    const queryWithoutSmartCab = removeSmartCabTermsFromQuery(queryWithBoundaries);
    const queryWithoutLeftOriginalTerms = removeLeftOriginalTermsFromQuery(queryWithoutSmartCab);
    const queryWithoutMoveSteeringTerms = removeMoveSteeringTermsFromQuery(queryWithoutLeftOriginalTerms);
    const queryWithoutLaoCenterTerms = removeLaoCenterTermsFromQuery(queryWithoutMoveSteeringTerms);
    const queryWithoutChampTerms = removeChampTermsFromQuery(queryWithoutLaoCenterTerms);
    const queryWithoutRoccoTerms = removeRoccoTermsFromQuery(queryWithoutChampTerms);
    const queryWithoutVxlTerms = removeVxlTermsFromQuery(queryWithoutRoccoTerms);
    const queryWithoutVxrTerms = removeVxrTermsFromQuery(queryWithoutVxlTerms);
    const queryWithoutTeiyTerms = removeTeiyTermsFromQuery(queryWithoutVxrTerms);
    const queryWithoutLegenderTerms = removeLegenderTermsFromQuery(queryWithoutTeiyTerms);
    const queryWithoutKapukTerms = removeKapukTermsFromQuery(queryWithoutLegenderTerms);
    const queryWithoutAutoTerms = removeAutoTermsFromQuery(queryWithoutKapukTerms);
    const queryWithoutFeatureTerms = removePhovinTermsFromQuery(queryWithoutAutoTerms);
    const baseQuery = getModelNameFromQuery(queryWithoutFeatureTerms);
    const queryYears = extractYearsFromQuery(queryWithBoundaries);

    const leadingLatinTokenMatch = queryWithBoundaries.match(/^([a-zA-Z0-9]+)/);
    const leadingLatinToken = leadingLatinTokenMatch?.[1]?.trim() ?? '';

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

    // Keep a clearly typed Latin model token stable (e.g. "Vigo ..." should not drift to "Vigor").
    if (leadingLatinToken) {
      const canonicalFromLeadingToken = getCanonicalModelDisplayName(leadingLatinToken);
      if (canonicalFromLeadingToken) {
        modelQueryForSuggestions = leadingLatinToken;
        canonicalName = canonicalFromLeadingToken;
      }
    }

    if (!canonicalName && trailingModelPart && trailingDigitsPrefix) {
      const fallbackCanonical = getCanonicalModelDisplayName(trailingModelPart);
      if (fallbackCanonical) {
        canonicalName = fallbackCanonical;
        modelQueryForSuggestions = trailingModelPart;
      }
    }

    // Expand search terms using the resolved model query
    const terms = expandWithoutBrandAliases(modelQueryForSuggestions || queryWithBoundaries)
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);

    if (!canonicalName) {
      if (terms.length === 0) {
        return NextResponse.json(
          { suggestions: [] },
          { headers: { 'Cache-Control': 'private, max-age=0' } }
        );
      }

      canonicalName = query.trim() || terms[0] || queryWithBoundaries;
      modelQueryForSuggestions = queryWithBoundaries;
    }

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
    const availableRoccoTerms = collectAvailableRoccoTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableVxlTerms = collectAvailableVxlTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableVxrTerms = collectAvailableVxrTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableTeiyTerms = collectAvailableTeiyTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableLegenderTerms = collectAvailableLegenderTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableKapukTerms = collectAvailableKapukTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availableAutoTerms = collectAvailableAutoTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const availablePhovinTerms = collectAvailablePhovinTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );
    const queryTargetsVxlGroup = availableVxlTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsVxrGroup = availableVxrTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsTeiyGroup = availableTeiyTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsLegenderGroup = availableLegenderTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsKapukGroup = availableKapukTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsAutoGroup = availableAutoTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const queryTargetsPhovinGroup = availablePhovinTerms.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const prioritizedSmartCabTerms = ['ແຄັບ', 'cap', 'smartcap', 'smart cap', 'smartcab', 'smart-cab'];
    const queryTargetsSmartCabGroup = SMART_CAB_SUGGESTION_TERMS.some((term) =>
      queryContainsTerm(queryWithBoundaries, term),
    );
    const smartCabTermsForSuggestionList = queryTargetsSmartCabGroup
      ? Array.from(
        new Set([
          ...prioritizedSmartCabTerms,
          ...SMART_CAB_SUGGESTION_TERMS,
          ...availableSmartCabTerms,
        ]),
      )
      : availableSmartCabTerms;

    const queryNormalized = normalizeText(queryWithBoundaries);
    const smartCabFirstIndex = firstIndexOfAnyTerm(queryNormalized, availableSmartCabTerms);
    const leftOriginalFirstIndex = firstIndexOfAnyTerm(queryNormalized, availableLeftOriginalTerms);
    const preferSmartCabBeforeLeft =
      smartCabFirstIndex >= 0 && leftOriginalFirstIndex >= 0
        ? smartCabFirstIndex < leftOriginalFirstIndex
        : false;

    const prefersNoSpaceSmartCab = /\s/.test(queryWithBoundaries) === false;
    const smartCabSuggestions = smartCabTermsForSuggestionList.flatMap((term) => {
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

    const roccoSuggestions = availableRoccoTerms.map((term) => `${canonicalName} ${term}`);

    const roccoYearSuggestions = availableRoccoTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const vxlSuggestions = availableVxlTerms.map((term) => `${canonicalName} ${term}`);

    const vxlYearSuggestions = availableVxlTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const vxrSuggestions = availableVxrTerms.map((term) => `${canonicalName} ${term}`);

    const vxrYearSuggestions = availableVxrTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const teiySuggestions = availableTeiyTerms.map((term) => `${canonicalName} ${term}`);

    const teiyYearSuggestions = availableTeiyTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const legenderSuggestions = availableLegenderTerms.map((term) => `${canonicalName} ${term}`);

    const legenderYearSuggestions = availableLegenderTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const kapukSuggestions = availableKapukTerms.map((term) => `${canonicalName} ${term}`);

    const kapukYearSuggestions = availableKapukTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const autoSuggestions = availableAutoTerms.map((term) => `${canonicalName} ${term}`);

    const autoYearSuggestions = availableAutoTerms.flatMap((term) => {
      const realYears = collectYearsForTerm(
        matchedPosts as Array<{ caption?: unknown }>,
        term,
        yearsForSuggestions,
      );
      return realYears.map((year) => `${canonicalName} ${term} ${year}`);
    });

    const phovinSuggestions = availablePhovinTerms.map((term) => `${canonicalName} ${term}`);

    const phovinYearSuggestions = availablePhovinTerms.flatMap((term) => {
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
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
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

    const roccoCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: roccoMixedSuggestions,
      mixedYearSuggestions: roccoMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableRoccoTerms,
      roccoCompanionGroups,
    );

    const vxlCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: vxlMixedSuggestions,
      mixedYearSuggestions: vxlMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableVxlTerms,
      vxlCompanionGroups,
    );

    const vxrCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: vxrMixedSuggestions,
      mixedYearSuggestions: vxrMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableVxrTerms,
      vxrCompanionGroups,
    );

    const teiyCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: teiyMixedSuggestions,
      mixedYearSuggestions: teiyMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableTeiyTerms,
      teiyCompanionGroups,
    );

    const legenderCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableKapukTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: legenderMixedSuggestions,
      mixedYearSuggestions: legenderMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableLegenderTerms,
      legenderCompanionGroups,
    );

    const kapukCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableAutoTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: kapukMixedSuggestions,
      mixedYearSuggestions: kapukMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableKapukTerms,
      kapukCompanionGroups,
    );

    const autoCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availablePhovinTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: autoMixedSuggestions,
      mixedYearSuggestions: autoMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availableAutoTerms,
      autoCompanionGroups,
    );

    const phovinCompanionGroups = [
      availableSmartCabTerms,
      availableLeftOriginalTerms,
      availableMoveSteeringTerms,
      availableLaoCenterTerms,
      availableChampTerms,
      availableRoccoTerms,
      availableVxlTerms,
      availableVxrTerms,
      availableTeiyTerms,
      availableLegenderTerms,
      availableKapukTerms,
      availableAutoTerms,
    ].filter((group) => group.length > 0);

    const {
      mixedSuggestions: phovinMixedSuggestions,
      mixedYearSuggestions: phovinMixedYearSuggestions,
    } = buildMixedSuggestionsForGroup(
      canonicalName,
      queryNormalized,
      matchedPosts as Array<{ caption?: unknown }>,
      yearsForSuggestions,
      availablePhovinTerms,
      phovinCompanionGroups,
    );

    // Build raw suggestions first, then re-rank by typed feature intent.
    const rawSuggestions = [
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
      ...roccoSuggestions,
      ...roccoYearSuggestions,
      ...vxlSuggestions,
      ...vxlYearSuggestions,
      ...vxrSuggestions,
      ...vxrYearSuggestions,
      ...teiySuggestions,
      ...teiyYearSuggestions,
      ...legenderSuggestions,
      ...legenderYearSuggestions,
      ...kapukSuggestions,
      ...kapukYearSuggestions,
      ...autoSuggestions,
      ...autoYearSuggestions,
      ...phovinSuggestions,
      ...phovinYearSuggestions,
      ...champMixedSuggestions,
      ...champMixedYearSuggestions,
      ...roccoMixedSuggestions,
      ...roccoMixedYearSuggestions,
      ...vxlMixedSuggestions,
      ...vxlMixedYearSuggestions,
      ...vxrMixedSuggestions,
      ...vxrMixedYearSuggestions,
      ...teiyMixedSuggestions,
      ...teiyMixedYearSuggestions,
      ...legenderMixedSuggestions,
      ...legenderMixedYearSuggestions,
      ...kapukMixedSuggestions,
      ...kapukMixedYearSuggestions,
      ...autoMixedSuggestions,
      ...autoMixedYearSuggestions,
      ...phovinMixedSuggestions,
      ...phovinMixedYearSuggestions,
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
    ].filter((item, index, arr) => arr.indexOf(item) === index);

    const availableFeatureTerms = Array.from(
      new Set([
        ...smartCabTermsForSuggestionList,
        ...availableLeftOriginalTerms,
        ...availableMoveSteeringTerms,
        ...availableLaoCenterTerms,
        ...availableChampTerms,
        ...availableRoccoTerms,
        ...availableVxlTerms,
        ...availableVxrTerms,
        ...availableTeiyTerms,
        ...availableLegenderTerms,
        ...availableKapukTerms,
        ...availableAutoTerms,
        ...availablePhovinTerms,
      ].filter(Boolean)),
    );

    const preferredFeatureTerms = Array.from(
      new Set([
        ...(queryTargetsSmartCabGroup
          ? smartCabTermsForSuggestionList
          : []),
        ...(availableLeftOriginalTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableLeftOriginalTerms
          : []),
        ...(availableMoveSteeringTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableMoveSteeringTerms
          : []),
        ...(availableLaoCenterTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableLaoCenterTerms
          : []),
        ...(availableChampTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableChampTerms
          : []),
        ...(availableRoccoTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableRoccoTerms
          : []),
        ...(availableVxlTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableVxlTerms
          : []),
        ...(availableVxrTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableVxrTerms
          : []),
        ...(availableTeiyTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableTeiyTerms
          : []),
        ...(availableLegenderTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableLegenderTerms
          : []),
        ...(availableKapukTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableKapukTerms
          : []),
        ...(availableAutoTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availableAutoTerms
          : []),
        ...(availablePhovinTerms.some((term) => queryContainsTerm(queryWithBoundaries, term))
          ? availablePhovinTerms
          : []),
      ].filter(Boolean)),
    );

    const featureQueryFragments = extractFeatureQueryFragments(queryWithBoundaries, canonicalName);
    const preferYearOnlySuggestions = !hasFeatureLikeQueryFragment(featureQueryFragments);

    const rankedSuggestions = rawSuggestions
      .map((suggestion, index) => ({
        suggestion,
        index,
        score: scoreSuggestionByTypedIntent(
          suggestion,
          canonicalName,
          featureQueryFragments,
          availableFeatureTerms,
          preferredFeatureTerms,
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsVxlGroup ? availableVxlTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsVxrGroup ? availableVxrTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsTeiyGroup ? availableTeiyTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsLegenderGroup ? availableLegenderTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsKapukGroup ? availableKapukTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsAutoGroup ? availableAutoTerms : [],
        ) + scoreSuggestionByActiveGroupTerms(
          suggestion,
          canonicalName,
          queryTargetsPhovinGroup ? availablePhovinTerms : [],
        ),
      }))
      .sort((left, right) => {
        const leftIsCanonical = left.suggestion === canonicalName;
        const rightIsCanonical = right.suggestion === canonicalName;
        if (leftIsCanonical !== rightIsCanonical) return leftIsCanonical ? -1 : 1;

        if (preferYearOnlySuggestions) {
          const leftIsYearOnly = isYearOnlySuggestion(left.suggestion, canonicalName);
          const rightIsYearOnly = isYearOnlySuggestion(right.suggestion, canonicalName);
          if (leftIsYearOnly !== rightIsYearOnly) return leftIsYearOnly ? -1 : 1;
        }

        if (right.score !== left.score) return right.score - left.score;
        return left.index - right.index;
      })
      .map((item) => item.suggestion);

    const allSuggestions = rankedSuggestions.slice(0, MAX_SUGGESTIONS_POOL);

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
