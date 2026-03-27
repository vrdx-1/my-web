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
  if (!session?.user?.id) return { ok: false as const, status: 401 as const, adminId: '' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (profile?.role !== 'admin') return { ok: false as const, status: 403 as const, adminId: '' };
  return { ok: true as const, adminId: session.user.id };
}

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await ensureAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: { action: string; reject_reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, reject_reason } = body;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server configuration missing' }, { status: 503 });

  // Get the request to find user_id
  const { data: verReq, error: fetchErr } = await admin
    .from('verification_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !verReq) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (verReq.status !== 'pending') {
    return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  // Update the verification request
  const { error: updateErr } = await admin
    .from('verification_requests')
    .update({
      status: newStatus,
      reject_reason: action === 'reject' ? (reject_reason || null) : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.adminId,
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If approved, set is_verified = true on the profile
  if (action === 'approve') {
    await admin
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', verReq.user_id);
  }

  return NextResponse.json({ success: true });
}
