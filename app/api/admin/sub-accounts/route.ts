import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type EnsureAdminOptions = {
  allowSubAccounts?: boolean;
};

type EnsureAdminResult =
  | { ok: true; adminId: string; isSubAccount: boolean }
  | { ok: false; status: 401 | 403; error: string };

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
}

async function ensureAdmin(options: EnsureAdminOptions = {}): Promise<EnsureAdminResult> {
  const { allowSubAccounts = true } = options;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  let userId: string | null = null;

  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  if (cookieUser?.id) {
    userId = cookieUser.id;
  }

  if (!userId) {
    const headerStore = await import('next/headers');
    const requestHeaders = await headerStore.headers();
    const authHeader = requestHeaders.get('authorization') || requestHeaders.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (accessToken) {
      const { data: { user: headerUser } } = await supabase.auth.getUser(accessToken);
      if (headerUser?.id) {
        userId = headerUser.id;
      }
    }
  }

  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_sub_account')
    .eq('id', userId)
    .single();

  if (error || profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  if (!allowSubAccounts && profile.is_sub_account) {
    return { ok: false, status: 403, error: 'Sub accounts cannot manage other sub accounts' };
  }

  return { ok: true, adminId: userId, isSubAccount: Boolean(profile.is_sub_account) };
}

export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, username, avatar_url, is_sub_account, parent_admin_id, updated_at')
    .eq('is_sub_account', true)
    .eq('parent_admin_id', auth.adminId)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subAccounts = (data ?? []).map((row) => ({
    id: row.id,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    updated_at: row.updated_at ?? null,
  }));

  return NextResponse.json({ subAccounts });
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let body: { username?: string; phone?: string; avatar_url?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const avatarUrl = typeof body?.avatar_url === 'string' ? body.avatar_url.trim() : null;

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  const finalUsername = username.slice(0, 50);
  const finalPhone = phone.slice(0, 30);
  const subAccountId = crypto.randomUUID();
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: subAccountId,
      username: finalUsername,
      phone: finalPhone || null,
      avatar_url: avatarUrl || null,
      role: 'admin',
      is_sub_account: true,
      parent_admin_id: auth.adminId,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    subAccount: {
      id: subAccountId,
      username: finalUsername,
      phone: finalPhone || null,
      avatar_url: avatarUrl || null,
      role: 'admin',
      is_sub_account: true,
      parent_admin_id: auth.adminId,
    },
  }, { status: 201 });
}