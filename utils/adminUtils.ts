/**
 * Admin Utilities
 * Shared functions for admin pages
 */

import { FilterType } from './constants';

/**
 * Calculate date range based on filter type
 * @param filter - Filter type: 'D' (Today), 'W' (Week), 'M' (Month), 'Y' (Year), 'A' (All)
 * @returns Start date string in ISO format, or null for 'A' (All Time)
 */
export function getFilterDateRange(filter: FilterType): string | null {
  if (filter === 'A') return null;

  const now = new Date();
  let startDate: Date;

  switch (filter) {
    case 'D':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'W':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'M':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'Y':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }

  return startDate.toISOString();
}

/**
 * Apply date filter to Supabase query
 * @param query - Supabase query builder
 * @param filter - Filter type
 * @param dateColumn - Column name for date comparison (default: 'created_at')
 * @returns Modified query
 */
export function applyDateFilter<T>(
  query: any,
  filter: FilterType,
  dateColumn: string = 'created_at'
): any {
  const startDate = getFilterDateRange(filter);
  if (startDate) {
    return query.gt(dateColumn, startDate);
  }
  return query;
}

/**
 * Format date for admin display
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatAdminDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Create Supabase client for admin pages
 * Uses createBrowserClient from @supabase/ssr
 */
export function createAdminSupabaseClient() {
  // Dynamic import to avoid SSR issues
  if (typeof window === 'undefined') {
    return null;
  }
  
  const { createBrowserClient } = require('@supabase/ssr');
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
