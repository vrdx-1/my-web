import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

type SearchType = 'manual' | 'suggestion' | 'history';
type ActorRole = 'guest' | 'user' | 'admin' | 'sub_admin';

type SearchLogRow = {
  id: string;
  search_term: string;
  display_text: string | null;
  search_type: SearchType;
  created_at: string;
  user_id: string | null;
  guest_token: string | null;
  actor_role: ActorRole | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  is_sub_account: boolean | null;
};

type PersonSummary = {
  person_key: string;
  person_label: string;
  person_type: 'guest' | 'user';
  total_searches: number;
  last_searched_at: string;
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { ok: false, status: 401 as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }

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

    const admin = createClient(
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

    let query = admin
      .from('search_logs')
      .select('id, search_term, display_text, search_type, created_at, user_id, guest_token, actor_role')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start) {
      query = query.gte('created_at', new Date(start).toISOString());
    }
    if (end) {
      query = query.lte('created_at', new Date(end).toISOString());
    }

    const { data: rows, error } = await query;
    if (error) {
      return internalServerError('admin/search-history query failed', error);
    }

    const allRows: SearchLogRow[] = (rows as SearchLogRow[] | null) || [];

    const userIds = Array.from(new Set(allRows.map((row) => row.user_id).filter((id): id is string => !!id)));
    const profileMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select('id, username, full_name, role, is_sub_account')
        .in('id', userIds);

      if (profileError) {
        return internalServerError('admin/search-history profile query failed', profileError);
      }

      for (const profile of (profiles as ProfileRow[] | null) || []) {
        profileMap.set(profile.id, profile);
      }
    }

    const normalizedRows = allRows
      .map((row) => {
        const isGuest = !row.user_id;
        const profile = row.user_id ? profileMap.get(row.user_id) || null : null;
        const role = row.actor_role || (isGuest ? 'guest' : 'user');

        const person_key = isGuest
          ? `guest:${(row.guest_token || '').trim() || 'unknown'}`
          : `user:${row.user_id}`;

        const person_type: 'guest' | 'user' = isGuest ? 'guest' : 'user';
        const person_label = isGuest
          ? personLabelForGuest(row.guest_token)
          : personLabelForUser(profile, row.user_id || '');

        return {
          ...row,
          actor_role: role as ActorRole,
          person_key,
          person_type,
          person_label,
          profile_role: profile?.role || null,
          profile_is_sub_account: !!profile?.is_sub_account,
        };
      })
      .filter((row) => row.actor_role === 'guest' || row.actor_role === 'user');

    const peopleMap = new Map<string, PersonSummary>();
    for (const row of normalizedRows) {
      const existing = peopleMap.get(row.person_key);
      if (!existing) {
        peopleMap.set(row.person_key, {
          person_key: row.person_key,
          person_label: row.person_label,
          person_type: row.person_type,
          total_searches: 1,
          last_searched_at: row.created_at,
        });
      } else {
        existing.total_searches += 1;
        if (new Date(row.created_at) > new Date(existing.last_searched_at)) {
          existing.last_searched_at = row.created_at;
        }
      }
    }

    const people = Array.from(peopleMap.values()).sort((a, b) => {
      if (b.total_searches !== a.total_searches) return b.total_searches - a.total_searches;
      return new Date(b.last_searched_at).getTime() - new Date(a.last_searched_at).getTime();
    });

    const scopedRows = personKey
      ? normalizedRows.filter((row) => row.person_key === personKey)
      : normalizedRows;

    const uniqueTerms = new Set(
      scopedRows
        .map((log) => (log.search_term || '').toLowerCase())
        .filter(Boolean)
    ).size;

    const manualSearches = scopedRows.filter((log) => log.search_type === 'manual').length;
    const suggestionSearches = scopedRows.filter((log) => log.search_type === 'suggestion').length;
    const historySearches = scopedRows.filter((log) => log.search_type === 'history').length;

    const termCounts: Record<string, {
      search_term: string;
      display_text: string | null;
      search_count: number;
      manual_count: number;
      suggestion_count: number;
      history_count: number;
      last_searched_at: string;
    }> = {};

    for (const row of scopedRows) {
      const rawTerm = (row.search_term || '').trim();
      if (!rawTerm) continue;
      const key = rawTerm.toLowerCase();
      if (!termCounts[key]) {
        termCounts[key] = {
          search_term: rawTerm,
          display_text: row.display_text || rawTerm,
          search_count: 0,
          manual_count: 0,
          suggestion_count: 0,
          history_count: 0,
          last_searched_at: row.created_at,
        };
      }

      termCounts[key].search_count += 1;
      if (row.search_type === 'manual') termCounts[key].manual_count += 1;
      else if (row.search_type === 'suggestion') termCounts[key].suggestion_count += 1;
      else termCounts[key].history_count += 1;

      if (new Date(row.created_at) > new Date(termCounts[key].last_searched_at)) {
        termCounts[key].last_searched_at = row.created_at;
      }
    }

    const topSearches = Object.values(termCounts)
      .sort((a, b) => {
        if (b.search_count !== a.search_count) return b.search_count - a.search_count;
        return new Date(b.last_searched_at).getTime() - new Date(a.last_searched_at).getTime();
      })
      .slice(0, 100);

    const recentSearches = scopedRows.slice(0, 200).map((row) => ({
      id: row.id,
      search_term: row.search_term,
      display_text: row.display_text,
      search_type: row.search_type,
      created_at: row.created_at,
      person_key: row.person_key,
      person_label: row.person_label,
      person_type: row.person_type,
    }));

    return NextResponse.json({
      scope: { personKey: personKey || null },
      stats: {
        totalSearches: scopedRows.length,
        uniqueTerms,
        manualSearches,
        suggestionSearches,
        historySearches,
      },
      people,
      topSearches,
      recentSearches,
    });
  } catch (e) {
    return internalServerError('admin/search-history unexpected error', e);
  }
}
