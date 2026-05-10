import { createBrowserClient } from '@supabase/ssr';

type BrowserClient = ReturnType<typeof createBrowserClient>;

const ADMIN_SUPABASE_CLIENT_KEY = '__jutpai_admin_supabase_client__';

function getGlobalStore(): Record<string, unknown> | null {
  if (typeof globalThis === 'undefined') return null;
  return globalThis as unknown as Record<string, unknown>;
}

/**
 * Admin Supabase Client
 * Centralized function for creating admin supabase client
 * Used across all admin pages to ensure consistency
 */
export function createAdminSupabaseClient() {
  const store = getGlobalStore();
  const existing = store?.[ADMIN_SUPABASE_CLIENT_KEY] as BrowserClient | undefined;
  if (existing) return existing;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  if (store) {
    store[ADMIN_SUPABASE_CLIENT_KEY] = client;
  }

  return client;
}
