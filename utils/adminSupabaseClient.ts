import { createBrowserClient } from '@supabase/ssr';

/**
 * Admin Supabase Client
 * Centralized function for creating admin supabase client
 * Used across all admin pages to ensure consistency
 */
export function createAdminSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
