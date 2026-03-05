import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const MAX_IDS = 200;

/**
 * POST /api/profiles/last-seen
 * Body: { userIds: string[] }
 * Returns: { lastSeen: Record<string, string | null> }
 * ใช้สำหรับอัปเดตสถานะออนไลน์ใน feed โดยไม่ต้องโหลด feed ใหม่
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw = body.userIds;
    const userIds = Array.isArray(raw)
      ? (raw as string[])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .slice(0, MAX_IDS)
      : [];
    if (userIds.length === 0) {
      return NextResponse.json({ lastSeen: {} }, { headers: { 'Cache-Control': 'private, max-age=0' } });
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

    const { data, error } = await supabase
      .from('profiles')
      .select('id, last_seen')
      .in('id', userIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lastSeen: Record<string, string | null> = {};
    (data || []).forEach((row: { id: string; last_seen: string | null }) => {
      lastSeen[row.id] = row.last_seen ?? null;
    });

    return NextResponse.json(
      { lastSeen },
      { headers: { 'Cache-Control': 'private, max-age=0' } }
    );
  } catch (err: unknown) {
    console.error('API /api/profiles/last-seen POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
