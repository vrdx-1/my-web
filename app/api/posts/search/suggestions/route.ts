import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';
import { expandWithoutBrandAliases, captionMatchesAnyAlias, getCanonicalModelDisplayName } from '@/utils/postUtils';
import { generateYearSuggestions, getModelNameFromQuery, formatYearSuggestion, extractYearsFromQuery, extractPartialYearPrefix } from '@/utils/yearSearchUtils';
import { collectAvailableSmartCabTerms, removeSmartCabTermsFromQuery } from '@/utils/smartCabSuggestionTerms';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';

const SUGGESTION_LIMIT = 300;
const MAX_SUGGESTIONS = 30;

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

    if (query.length === 0) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: { 'Cache-Control': 'private, max-age=0' } }
      );
    }

    // Extract base model name (without year / Smart Cab suffix terms)
    const queryWithoutSmartCab = removeSmartCabTermsFromQuery(query);
    const baseQuery = getModelNameFromQuery(queryWithoutSmartCab);
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
    const partialPrefix = extractPartialYearPrefix(queryWithoutSmartCab) ?? trailingDigitsPrefix;
    const yearsForSuggestions = queryYears.length > 0
      ? availableYears.filter((year) => queryYears.includes(year))
      : partialPrefix
        ? availableYears.filter((year) => String(year).startsWith(partialPrefix))
        : availableYears;

    // Show all Smart Cab keyword variants in this group when they exist in matched captions.
    const availableSmartCabTerms = collectAvailableSmartCabTerms(
      matchedPosts as Array<{ caption?: unknown }>
    );

    const prefersNoSpaceSmartCab = /\s/.test(query) === false;
    const smartCabSuggestions = availableSmartCabTerms.flatMap((term) => {
      const noSpace = `${canonicalName}${term}`;
      const withSpace = `${canonicalName} ${term}`;
      return prefersNoSpaceSmartCab ? [noSpace, withSpace] : [withSpace, noSpace];
    });

    // Order: base model/brand first, then year suggestions, then Smart Cab grouped suggestions.
    const suggestions = [
      canonicalName,
      ...yearsForSuggestions.map((year) => formatYearSuggestion(canonicalName, year)),
      ...smartCabSuggestions,
    ].filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, MAX_SUGGESTIONS);

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    return internalServerError('posts/search/suggestions unexpected error', error);
  }
}
