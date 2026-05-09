import { createBrowserClient } from '@supabase/ssr';

let adminBrowserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Admin Supabase Client
 * Centralized function for creating admin supabase client
 * Used across all admin pages to ensure consistency
 */
export function createAdminSupabaseClient() {
  if (adminBrowserClient) return adminBrowserClient;

  adminBrowserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return adminBrowserClient;
}
