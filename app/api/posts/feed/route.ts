import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { expandCarSearchAliases } from '@/utils/postUtils';
import { PREFETCH_COUNT } from '@/utils/constants';
import carsData from '@/data';

// Helper: normalize สำหรับ fallback lookup
function normalizeForFallback(text: string): string {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Helper: หา brand names ทั้งหมดจาก dictionary (cache)
const BRAND_NAMES_SET = (() => {
  const set = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    const en = String(brand.brandName ?? '').trim();
    const th = String((brand as any).brandNameTh ?? '').trim();
    const lo = String((brand as any).brandNameLo ?? '').trim();
    if (en) set.add(normalizeForFallback(en));
    if (th) set.add(normalizeForFallback(th));
    if (lo) set.add(normalizeForFallback(lo));
  }
  return set;
})();

// Helper: normalize สำหรับค้นหาใน dictionary
function normalizeCarSearch(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

// Helper: expand โดยกรอง brand aliases และ model aliases อื่นๆ ออกเมื่อค้น model (เพื่อให้ได้ผลที่ตรงคำค้น)
function expandWithoutBrandAliases(query: string): string[] {
  const expanded = expandCarSearchAliases(query);
  if (expanded.length <= 1) return expanded;

  const queryNorm = normalizeCarSearch(query);
  
  // ถ้า query เป็น brand name → เก็บ brand aliases ไว้ (ไม่กรอง)
  if (BRAND_NAMES_SET.has(normalizeForFallback(query))) {
    return expanded; // ค้น brand → ใช้ทุกอย่าง (brand + models)
  }

  // ถ้า query เป็น model → กรอง brand aliases และ model aliases อื่นๆ ออก
  // หา entities ที่ตรงกับ query
  const matchingEntities = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      const modelAliasesNorm = modelAliases.map(a => normalizeCarSearch(String(a ?? ''))).filter(Boolean);
      if (modelAliasesNorm.includes(queryNorm)) {
        matchingEntities.add(`model:${brand.brandId}:${model.modelId}`);
      }
    }
  }

  // ถ้าไม่พบ matching entity → ใช้ expanded เดิม
  if (matchingEntities.size === 0) {
    const filtered = expanded.filter(term => {
      const termNorm = normalizeForFallback(term);
      return !BRAND_NAMES_SET.has(termNorm) || termNorm === normalizeForFallback(query);
    });
    return filtered.length > 0 ? filtered : [query];
  }

  // สร้าง Set ของ aliases ที่เป็นของ model อื่น (เพื่อกรองออก)
  const otherModelAliases = new Set<string>();
  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const entityKey = `model:${brand.brandId}:${model.modelId}`;
      if (matchingEntities.has(entityKey)) continue; // ข้าม matching entities

      // เก็บ aliases ของ model อื่น
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      for (const alias of modelAliases) {
        const a = String(alias ?? '').trim();
        if (a) {
          otherModelAliases.add(a);
          otherModelAliases.add(normalizeCarSearch(a));
        }
      }
    }
  }

  // กรองให้เหลือเฉพาะ aliases ที่เป็นของ matching entities เท่านั้น
  const validAliases = new Set<string>();
  validAliases.add(query); // เก็บ query เดิมเสมอ

  for (const brand of carsData.brands ?? []) {
    for (const model of brand.models ?? []) {
      const entityKey = `model:${brand.brandId}:${model.modelId}`;
      if (!matchingEntities.has(entityKey)) continue;

      // เก็บ aliases ของ model นี้ (เฉพาะที่ไม่ได้เป็น aliases ของ model อื่น)
      const modelAliases = [
        model.modelName,
        (model as any).modelNameTh,
        (model as any).modelNameLo,
        ...((model.searchNames ?? []) as any[]).map(String),
      ];
      for (const alias of modelAliases) {
        const a = String(alias ?? '').trim();
        if (!a) continue;
        
        const aNorm = normalizeCarSearch(a);
        const queryNorm = normalizeCarSearch(query);
        
        // เก็บถ้า: เป็น query เดิม หรือไม่ได้เป็น aliases ของ model อื่น
        if (queryNorm === aNorm || (!otherModelAliases.has(a) && !otherModelAliases.has(aNorm))) {
          validAliases.add(a);
        }
      }
    }
  }

  // กรอง expanded ให้เหลือเฉพาะ aliases ที่อยู่ใน validAliases เท่านั้น
  const filtered = expanded.filter(term => {
    const termStr = String(term ?? '').trim();
    if (!termStr) return false;
    
    // เก็บถ้า: อยู่ใน validAliases (ตรงเป๊ะหรือ normalized ตรงกัน)
    if (validAliases.has(termStr)) return true;
    
    const termNorm = normalizeCarSearch(termStr);
    for (const alias of validAliases) {
      if (normalizeCarSearch(alias) === termNorm) return true;
    }
    
    return false;
  });

  return filtered.length > 0 ? filtered : [query];
}

/**
 * ใช้ RPC ใน DB ส่ง terms ผ่าน body — คำไทย/ลาวไม่ผ่าน URL จึงค้นได้ครบ 3 ภาษา
 */
async function runFeedQueryMultiTermRpc(
  supabase: ReturnType<typeof createServerClient>,
  searchTerms: string[],
  startIndex: number,
  endIndex: number
): Promise<{ postIds: string[]; hasMore: boolean }> {
  const pageLen = endIndex - startIndex + 1;
  const { data, error } = await supabase.rpc('search_cars_by_caption_terms', {
    p_terms: searchTerms,
    p_start: startIndex,
    p_limit: pageLen + 1,
  });

  if (error) {
    return { postIds: [], hasMore: false };
  }

  const rows = Array.isArray(data) ? data : [];
  const postIds = rows.slice(0, pageLen).map((r: { id: string }) => String(r.id));
  const hasMore = rows.length > pageLen;

  return { postIds, hasMore };
}

function runFeedQuerySingle(
  supabase: ReturnType<typeof createServerClient>,
  searchTerms: string[],
  startIndex: number,
  endIndex: number
) {
  let query = supabase
    .from('cars')
    .select('id')
    .eq('status', 'recommend')
    .eq('is_hidden', false)
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (searchTerms.length === 1) {
    query = query.ilike('caption', `%${searchTerms[0]}%`);
  }

  return query;
}

/**
 * POST /api/posts/feed — body: { searchTerms: string[], startIndex, endIndex }
 * ใช้เมื่อ client ส่งคำที่ขยายแล้ว (ไทย/ลาว/อังกฤษ) ใน body เพื่อให้ค้นได้ครบทุกภาษา
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawTerms = body.searchTerms;
    let searchTerms = Array.isArray(rawTerms)
      ? rawTerms.map((t: unknown) => String(t ?? '').trim()).filter(Boolean)
      : [];
    const startIndex = parseInt(String(body.startIndex ?? 0));
    const endIndex = parseInt(String(body.endIndex ?? PREFETCH_COUNT - 1));

    // ขยายทุกคำที่ client ส่งมา (แม้หลายคำ) เพื่อให้แน่ใจว่าได้ผลครบทุกครั้ง
    // เพราะ client expansion อาจไม่เสถียร (race condition, dictionary load timing)
    // ใช้ expandWithoutBrandAliases เพื่อกรอง brand aliases ออกเมื่อค้น model (ให้ได้ผลที่ตรงคำค้น)
    const allExpanded = new Set<string>();
    for (const term of searchTerms) {
      const expanded = expandWithoutBrandAliases(String(term).trim());
      if (expanded.length > 0) {
        for (const e of expanded) allExpanded.add(String(e).trim());
      } else {
        allExpanded.add(String(term).trim());
      }
    }
    searchTerms = Array.from(allExpanded).filter(Boolean);
    
    // ถ้ายังได้คำเดียว ใช้ fallback สำหรับคำที่รู้จัก (ทั้งอังกฤษ/ไทย/ลาว)
    // และพยายาม expand อีกครั้งด้วย original query เพื่อให้แน่ใจว่าได้ผลครบ
    if (searchTerms.length === 1) {
      const one = searchTerms[0];
      const fallback: Record<string, string[]> = {
        revo: ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
        'รีโว่': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
        'รีโว้': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
        'ລີໂວ້': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
        vigo: ['vigo', 'วีโก้', 'ວີໂກ້'],
        'วีโก้': ['vigo', 'วีโก้', 'ວີໂກ້'],
        'ວີໂກ້': ['vigo', 'วีโก้', 'ວີໂກ້'],
        vios: ['vios', 'วีออส', 'ວີອອສ'],
        'วีออส': ['vios', 'วีออส', 'ວີອອສ'],
        'ວີອອສ': ['vios', 'วีออส', 'ວີອອສ'],
        fortuner: ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
        'ฟอร์จูนเนอร์': ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
        'ຟໍຈູນເນີ້': ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
        camry: ['camry', 'คัมรี่', 'ແຄມຣີ້'],
        'คัมรี่': ['camry', 'คัมรี่', 'ແຄມຣີ້'],
        'ແຄມຣີ້': ['camry', 'คัมรี่', 'ແຄມຣີ້'],
        hilux: ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
        'ไฮลักซ์': ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
        'ໄຮລັກ': ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
      };
      const key = normalizeForFallback(one);
      if (fallback[key]) {
        searchTerms = fallback[key].map((t) => String(t ?? '').trim()).filter(Boolean);
      } else {
        // ถ้าไม่มีใน fallback แต่ได้คำเดียว → พยายาม expand อีกครั้งด้วย original query จาก client
        // เพื่อให้แน่ใจว่าได้ผลครบ (กรณี dictionary index ไม่เสถียร)
        const originalQuery = rawTerms && Array.isArray(rawTerms) && rawTerms.length > 0 
          ? String(rawTerms[0]).trim() 
          : one;
        if (originalQuery) {
          const reExpanded = expandWithoutBrandAliases(originalQuery);
          if (reExpanded.length > 1) {
            const reExpandedSet = new Set<string>();
            for (const e of reExpanded) reExpandedSet.add(String(e).trim());
            searchTerms = Array.from(reExpandedSet).filter(Boolean);
          }
        }
      }
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

    // ใช้ RPC multi-term เสมอเมื่อมี search term (แม้ได้คำเดียว) เพื่อให้ผลสม่ำเสมอ
    if (searchTerms.length > 0) {
      const result = await runFeedQueryMultiTermRpc(supabase, searchTerms, startIndex, endIndex);
      return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=0' } });
    }

    // ไม่มี search term → ดึงโพสทั้งหมด
    const query = runFeedQuerySingle(supabase, [], startIndex, endIndex);
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const postIds = (data || []).map((p: { id: string }) => p.id);
    const hasMore = postIds.length >= PREFETCH_COUNT;

    return NextResponse.json(
      { postIds, hasMore },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err: any) {
    console.error('API /api/posts/feed POST:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posts/feed?searchTerm=revo&startIndex=0&endIndex=9
 * ค้นจาก query string (รองรับเมื่อมี searchTerm เดียวใน URL)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startIndex = parseInt(searchParams.get('startIndex') || '0');
    const endIndex = parseInt(searchParams.get('endIndex') || String(PREFETCH_COUNT - 1));
    const searchTerm = (searchParams.get('searchTerm') || '').trim();

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

    let searchTerms: string[] = [];
    if (searchTerm) {
      // ขยายเสมอเพื่อให้แน่ใจว่าได้ผลครบทุกครั้ง
      // ใช้ expandWithoutBrandAliases เพื่อกรอง brand aliases ออกเมื่อค้น model
      const expanded = expandWithoutBrandAliases(searchTerm);
      searchTerms = (expanded.length > 0 ? expanded : [searchTerm])
        .map((t) => String(t ?? '').trim())
        .filter(Boolean);
      // ถ้าขยายแล้วยังได้คำเดียว ใช้ fallback สำหรับคำที่รู้จัก (ทั้งอังกฤษ/ไทย/ลาว)
      // และพยายาม expand อีกครั้งด้วย original query เพื่อให้แน่ใจว่าได้ผลครบ
      if (searchTerms.length === 1) {
        const one = searchTerms[0];
        const fallback: Record<string, string[]> = {
          revo: ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
          'รีโว่': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
          'รีโว้': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
          'ລີໂວ້': ['revo', 'รีโว่', 'รีโว้', 'ລີໂວ້'],
          vigo: ['vigo', 'วีโก้', 'ວີໂກ້'],
          'วีโก้': ['vigo', 'วีโก้', 'ວີໂກ້'],
          'ວີໂກ້': ['vigo', 'วีโก้', 'ວີໂກ້'],
          vios: ['vios', 'วีออส', 'ວີອອສ'],
          'วีออส': ['vios', 'วีออส', 'ວີອອສ'],
          'ວີອອສ': ['vios', 'วีออส', 'ວີອອສ'],
          fortuner: ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
          'ฟอร์จูนเนอร์': ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
          'ຟໍຈູນເນີ້': ['fortuner', 'ฟอร์จูนเนอร์', 'ຟໍຈູນເນີ້'],
          camry: ['camry', 'คัมรี่', 'ແຄມຣີ້'],
          'คัมรี่': ['camry', 'คัมรี่', 'ແຄມຣີ້'],
          'ແຄມຣີ້': ['camry', 'คัมรี่', 'ແຄມຣີ້'],
          hilux: ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
          'ไฮลักซ์': ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
          'ໄຮລັກ': ['hilux', 'ไฮลักซ์', 'ໄຮລັກ'],
        };
        const key = normalizeForFallback(one);
        if (fallback[key]) {
          searchTerms = fallback[key].map((t) => String(t ?? '').trim()).filter(Boolean);
        } else {
          // ถ้าไม่มีใน fallback แต่ได้คำเดียว → พยายาม expand อีกครั้งด้วย original query
          // เพื่อให้แน่ใจว่าได้ผลครบ (กรณี dictionary index ไม่เสถียร)
          const reExpanded = expandWithoutBrandAliases(searchTerm);
          if (reExpanded.length > 1) {
            const reExpandedSet = new Set<string>();
            for (const e of reExpanded) reExpandedSet.add(String(e).trim());
            searchTerms = Array.from(reExpandedSet).filter(Boolean);
          }
        }
      }
    }

    // ใช้ RPC multi-term เสมอเมื่อมี search term (แม้ได้คำเดียว) เพื่อให้ผลสม่ำเสมอ
    if (searchTerms.length > 0) {
      const result = await runFeedQueryMultiTermRpc(supabase, searchTerms, startIndex, endIndex);
      return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=0' } });
    }

    // ไม่มี search term → ดึงโพสทั้งหมด
    const query = runFeedQuerySingle(supabase, [], startIndex, endIndex);
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const postIds = (data || []).map((p: { id: string }) => p.id);
    const hasMore = postIds.length >= PREFETCH_COUNT;

    return NextResponse.json(
      { postIds, hasMore },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err: any) {
    console.error('API /api/posts/feed GET:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
