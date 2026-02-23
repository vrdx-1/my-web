import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function ensureAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401 as const };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }
  return { ok: true };
}

/**
 * GET /api/admin/search-logs-by-user?start=...
 * คืนค่ารายละเอียดรายคน: แต่ละ user_id หรือ guest_token ค้นหาอะไรบ้าง กี่ครั้ง
 */
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || undefined;

  let query = admin
    .from('search_logs')
    .select('id, user_id, guest_token, search_term, search_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (start) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime())) {
      query = query.gte('created_at', startDate.toISOString());
    }
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows || []) as { id: string; user_id: string | null; guest_token: string | null; search_term: string; search_type: string; created_at: string }[];

  type TermCount = { count: number; manual: number; suggestion: number; history: number; last_at: string };
  const byKey = new Map<string, { isGuest: boolean; key: string; terms: Map<string, TermCount>; total: number; lastAt: string }>();

  for (const r of list) {
    const key = r.user_id ?? r.guest_token ?? 'unknown';
    const isGuest = !r.user_id;
    if (!byKey.has(key)) {
      byKey.set(key, {
        isGuest,
        key,
        terms: new Map(),
        total: 0,
        lastAt: r.created_at,
      });
    }
    const rec = byKey.get(key)!;
    rec.total += 1;
    if (r.created_at > rec.lastAt) rec.lastAt = r.created_at;

    const term = r.search_term;
    if (!rec.terms.has(term)) {
      rec.terms.set(term, { count: 0, manual: 0, suggestion: 0, history: 0, last_at: r.created_at });
    }
    const tc = rec.terms.get(term)!;
    tc.count += 1;
    if (r.search_type === 'manual') tc.manual += 1;
    else if (r.search_type === 'suggestion') tc.suggestion += 1;
    else tc.history += 1;
    if (r.created_at > tc.last_at) tc.last_at = r.created_at;
  }

  const byUser = Array.from(byKey.entries()).map(([k, v]) => ({
    identifier: k,
    isGuest: v.isGuest,
    totalSearches: v.total,
    lastSearchedAt: v.lastAt,
    terms: Array.from(v.terms.entries()).map(([term, tc]) => ({
      search_term: term,
      count: tc.count,
      manual: tc.manual,
      suggestion: tc.suggestion,
      history: tc.history,
      last_at: tc.last_at,
    })).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.totalSearches - a.totalSearches);

  return NextResponse.json({ byUser });
}
