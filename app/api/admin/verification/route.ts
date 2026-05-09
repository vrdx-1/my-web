import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { internalServerError } from '@/lib/apiSecurity';

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
  if (authError || !user?.id) return { ok: false as const, status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return { ok: false as const, status: 403 as const };
  return { ok: true as const, adminId: user.id };
}

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') || 'pending';

  const { data, error } = await admin
    .from('verification_requests')
    .select(`
      id, user_id, document_type, document_url, selfie_url,
      status, reject_reason, created_at, reviewed_at,
      profiles!verification_requests_user_id_fkey(username, avatar_url)
    `)
    .eq('status', statusFilter)
    .order('created_at', { ascending: true });

  if (error) return internalServerError('admin/verification list failed', error);

  return NextResponse.json({ requests: data ?? [] });
}
