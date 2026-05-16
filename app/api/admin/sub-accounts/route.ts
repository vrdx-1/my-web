import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError, tooManyRequests } from '@/lib/apiSecurity';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { normalizeWhatsAppNumberSource } from '@/utils/whatsapp';

type EnsureAdminOptions = {
  allowSubAccounts?: boolean;
};

type EnsureAdminResult =
  | {
      ok: true;
      actorId: string;
      adminId: string;
      isSubAccount: boolean;
      actorPhone: string | null;
      actorWhatsappNumberSource: string;
    }
  | { ok: false; status: 401 | 403; error: string };

function isMissingWhatsappSourceColumnError(error: unknown): boolean {
  return String((error as { code?: string } | null)?.code || '') === '42703';
}

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

  const profileWithSource = await supabase
    .from('profiles')
    .select('role, is_sub_account, parent_admin_id, phone, whatsapp_number_source')
    .eq('id', userId)
    .single();

  const profileFallback = isMissingWhatsappSourceColumnError(profileWithSource.error)
    ? await supabase
        .from('profiles')
        .select('role, is_sub_account, parent_admin_id, phone')
        .eq('id', userId)
        .single()
    : null;

  const profile = (profileFallback?.data || profileWithSource.data) as {
    role?: string | null;
    is_sub_account?: boolean | null;
    parent_admin_id?: string | null;
    phone?: string | null;
    whatsapp_number_source?: string | null;
  } | null;
  const error = profileFallback?.error || profileWithSource.error;

  if (error || profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  if (!allowSubAccounts && profile.is_sub_account) {
    return { ok: false, status: 403, error: 'Sub accounts cannot manage other sub accounts' };
  }

  const adminId = profile.is_sub_account ? profile.parent_admin_id || userId : userId;

  return {
    ok: true,
    actorId: userId,
    adminId,
    isSubAccount: Boolean(profile.is_sub_account),
    actorPhone: profile.phone ?? null,
    actorWhatsappNumberSource: normalizeWhatsAppNumberSource(profile.whatsapp_number_source),
  };
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

  const adminProfileWithSource = await admin
    .from('profiles')
    .select('id, username, avatar_url, phone, role, is_sub_account, parent_admin_id, whatsapp_number_source, updated_at')
    .eq('id', auth.adminId)
    .single();

  const adminProfileFallback = isMissingWhatsappSourceColumnError(adminProfileWithSource.error)
    ? await admin
        .from('profiles')
        .select('id, username, avatar_url, phone, role, is_sub_account, parent_admin_id, updated_at')
        .eq('id', auth.adminId)
        .single()
    : null;

  const adminProfile = (adminProfileFallback?.data || adminProfileWithSource.data) as {
    id: string;
    username?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    role?: string | null;
    is_sub_account?: boolean | null;
    parent_admin_id?: string | null;
    whatsapp_number_source?: string | null;
    updated_at?: string | null;
  } | null;
  const adminProfileError = adminProfileFallback?.error || adminProfileWithSource.error;

  if (adminProfileError || !adminProfile) {
    return internalServerError('admin/sub-accounts admin profile lookup failed', adminProfileError);
  }

  const listWithSource = await admin
    .from('profiles')
    .select('id, username, avatar_url, phone, role, is_sub_account, parent_admin_id, whatsapp_number_source, updated_at')
    .eq('is_sub_account', true)
    .eq('parent_admin_id', auth.adminId)
    .order('updated_at', { ascending: false });

  const listFallback = isMissingWhatsappSourceColumnError(listWithSource.error)
    ? await admin
        .from('profiles')
        .select('id, username, avatar_url, phone, role, is_sub_account, parent_admin_id, updated_at')
        .eq('is_sub_account', true)
        .eq('parent_admin_id', auth.adminId)
        .order('updated_at', { ascending: false })
    : null;

  const data = (listFallback?.data || listWithSource.data) as Array<{
    id: string;
    username?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    role?: string | null;
    is_sub_account?: boolean | null;
    parent_admin_id?: string | null;
    whatsapp_number_source?: string | null;
    updated_at?: string | null;
  }> | null;
  const error = listFallback?.error || listWithSource.error;

  if (error) {
    return internalServerError('admin/sub-accounts list failed', error);
  }

  const subAccounts = (data ?? []).map((row) => ({
    id: row.id,
    username: row.username ?? null,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    role: row.role ?? 'admin',
    is_sub_account: Boolean(row.is_sub_account),
    parent_admin_id: row.parent_admin_id ?? null,
    whatsapp_number_source: normalizeWhatsAppNumberSource(row.whatsapp_number_source),
    updated_at: row.updated_at ?? null,
  }));

  return NextResponse.json({
    adminProfile: {
      id: adminProfile.id,
      username: adminProfile.username ?? null,
      phone: adminProfile.phone ?? null,
      avatar_url: adminProfile.avatar_url ?? null,
      role: adminProfile.role ?? 'admin',
      is_sub_account: Boolean(adminProfile.is_sub_account),
      parent_admin_id: adminProfile.parent_admin_id ?? null,
      whatsapp_number_source: normalizeWhatsAppNumberSource(adminProfile.whatsapp_number_source),
      updated_at: adminProfile.updated_at ?? null,
    },
    subAccounts,
  });
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:sub-accounts:create',
    identifier: ip,
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

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
    return internalServerError('admin/sub-accounts create failed', profileError);
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
      whatsapp_number_source: 'self',
    },
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit({
    namespace: 'admin:sub-accounts:whatsapp-settings',
    identifier: ip,
    limit: 60,
    windowSeconds: 60,
  });
  if (!rateLimit.success) return tooManyRequests(rateLimit.reset);

  const auth = await ensureAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });
  }

  let body: {
    profileId?: string;
    profileIds?: string[];
    whatsapp_number_source?: string;
    applyToAll?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const whatsappNumberSource = normalizeWhatsAppNumberSource(body?.whatsapp_number_source);
  const shouldApplyToAll = body?.applyToAll === true;
  const requestedProfileIds = Array.isArray(body?.profileIds)
    ? body.profileIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const profileId = typeof body?.profileId === 'string' ? body.profileId.trim() : '';

  const targetIds = shouldApplyToAll
    ? []
    : Array.from(new Set([profileId, ...requestedProfileIds].filter(Boolean)));

  if (!shouldApplyToAll && targetIds.length === 0) {
    return NextResponse.json({ error: 'Profile target required' }, { status: 400 });
  }

  let updateQuery = admin
    .from('profiles')
    .update({ whatsapp_number_source: whatsappNumberSource, updated_at: new Date().toISOString() })
    .eq('is_sub_account', true)
    .eq('parent_admin_id', auth.adminId);

  if (!shouldApplyToAll) {
    updateQuery = targetIds.length === 1
      ? updateQuery.eq('id', targetIds[0])
      : updateQuery.in('id', targetIds);
  }

  const { error } = await updateQuery;
  if (error) {
    if (isMissingWhatsappSourceColumnError(error)) {
      return NextResponse.json(
        { error: 'Database migration required: run migrations/add_whatsapp_number_source.sql' },
        { status: 409 }
      );
    }
    return internalServerError('admin/sub-accounts whatsapp settings update failed', error);
  }

  return NextResponse.json({
    ok: true,
    whatsapp_number_source: whatsappNumberSource,
    applyToAll: shouldApplyToAll,
    profileIds: shouldApplyToAll ? null : targetIds,
  });
}