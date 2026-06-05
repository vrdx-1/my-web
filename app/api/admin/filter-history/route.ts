import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

type FilterActorRole = 'guest' | 'user';

type FilterLogRow = {
  id: string;
  user_id: string | null;
  guest_token: string | null;
  actor_role: FilterActorRole;
  province: string | null;
  min_price_kip: number | null;
  max_price_kip: number | null;
  display_currency: '₭' | '$' | '฿' | null;
  price_sort_order: 'asc' | 'desc' | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
};

type NormalizedRow = FilterLogRow & {
  person_key: string;
  person_label: string;
  person_type: FilterActorRole;
};

type PersonSummary = {
  person_key: string;
  person_label: string;
  person_type: FilterActorRole;
  total_uses: number;
  last_used_at: string;
};

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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.id) return { ok: false, status: 401 as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { ok: false, status: 403 as const };
  return { ok: true };
}

function personLabelForGuest(guestToken: string | null): string {
  if (!guestToken) return 'Guest (unknown)';
  const compact = guestToken.trim();
  if (compact.length <= 12) return `Guest ${compact}`;
  return `Guest ${compact.slice(0, 6)}...${compact.slice(-4)}`;
}

function personLabelForUser(profile: ProfileRow | null, userId: string): string {
  const fullName = (profile?.full_name || '').trim();
  const username = (profile?.username || '').trim();
  if (fullName && username) return `${fullName} (@${username})`;
  if (fullName) return fullName;
  if (username) return `@${username}`;
  return `User ${userId.slice(0, 8)}`;
}

/**
 * GET /api/admin/filter-history
 * Query params: start, end, personKey, limit
 * Returns filter search history for admin analytics page
 */
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { searchParams } = request.nextUrl;
    const start = searchParams.get('start') || null;
    const end = searchParams.get('end') || null;
    const personKey = (searchParams.get('personKey') || '').trim();
    const limitRaw = parseInt(searchParams.get('limit') || '5000', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(10000, Math.max(100, limitRaw)) : 5000;

    // Query filter_search_logs
    let query = adminClient
      .from('filter_search_logs')
      .select('id, user_id, guest_token, actor_role, province, min_price_kip, max_price_kip, display_currency, price_sort_order, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start) query = query.gte('created_at', new Date(start).toISOString());
    if (end) query = query.lte('created_at', new Date(end).toISOString());

    const { data: rawRows, error: queryError } = await query;
    if (queryError) {
      return internalServerError('admin/filter-history query failed', queryError);
    }

    const rows = (rawRows as FilterLogRow[] | null) || [];

    // Fetch profiles for user rows
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id)));
    const profileMap = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, username, full_name, role')
        .in('id', userIds);
      for (const p of (profiles as ProfileRow[] | null) || []) {
        profileMap.set(p.id, p);
      }
    }

    // Normalize rows
    const allRows: NormalizedRow[] = rows.map((row) => {
      const isGuest = !row.user_id;
      const profile = row.user_id ? profileMap.get(row.user_id) || null : null;
      const person_key = isGuest
        ? `guest:${(row.guest_token || '').trim() || 'unknown'}`
        : `user:${row.user_id}`;
      const person_type: FilterActorRole = isGuest ? 'guest' : 'user';
      const person_label = isGuest
        ? personLabelForGuest(row.guest_token)
        : personLabelForUser(profile, row.user_id || '');
      return { ...row, person_key, person_type, person_label };
    });

    // Build people summary (across full date range, before personKey filter)
    const peopleMap = new Map<string, PersonSummary>();
    for (const row of allRows) {
      const ex = peopleMap.get(row.person_key);
      if (!ex) {
        peopleMap.set(row.person_key, {
          person_key: row.person_key,
          person_label: row.person_label,
          person_type: row.person_type,
          total_uses: 1,
          last_used_at: row.created_at,
        });
      } else {
        ex.total_uses += 1;
        if (new Date(row.created_at) > new Date(ex.last_used_at)) {
          ex.last_used_at = row.created_at;
        }
      }
    }
    const people = Array.from(peopleMap.values()).sort((a, b) => {
      if (b.total_uses !== a.total_uses) return b.total_uses - a.total_uses;
      return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
    });

    // Apply personKey scope for stats & recent
    const scopedRows = personKey
      ? allRows.filter((r) => r.person_key === personKey)
      : allRows;

    // Stats
    const totalFilters = scopedRows.length;
    const guestCount = scopedRows.filter((r) => r.person_type === 'guest').length;
    const userCount = scopedRows.filter((r) => r.person_type === 'user').length;
    const provinceCount = scopedRows.filter((r) => !!r.province).length;
    const priceRangeCount = scopedRows.filter((r) => r.min_price_kip != null || r.max_price_kip != null).length;
    const sortOrderCount = scopedRows.filter((r) => !!r.price_sort_order).length;

    // Top provinces
    const provinceCountMap = new Map<string, number>();
    for (const row of scopedRows) {
      if (row.province) {
        provinceCountMap.set(row.province, (provinceCountMap.get(row.province) || 0) + 1);
      }
    }
    const topProvinces = Array.from(provinceCountMap.entries())
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Recent 200 rows
    const recentFilters = scopedRows.slice(0, 200).map((r) => ({
      id: r.id,
      person_key: r.person_key,
      person_label: r.person_label,
      person_type: r.person_type,
      province: r.province,
      min_price_kip: r.min_price_kip,
      max_price_kip: r.max_price_kip,
      display_currency: r.display_currency,
      price_sort_order: r.price_sort_order,
      created_at: r.created_at,
    }));

    return NextResponse.json({
      stats: { totalFilters, guestCount, userCount, provinceCount, priceRangeCount, sortOrderCount },
      people,
      topProvinces,
      recentFilters,
    });
  } catch (e) {
    return internalServerError('admin/filter-history unexpected error', e);
  }
}
