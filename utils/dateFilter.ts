/**
 * Date Filter Utility
 * Provides date range calculation for admin filter options
 */

export type DateFilterType = 'D' | 'W' | 'M' | 'Y' | 'A';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

/**
 * Get date range based on filter type
 * @param filter - Filter type: D (Day), W (Week), M (Month), Y (Year), A (All)
 * @returns DateRange object with startDate and endDate (ISO strings)
 */
export function getDateRange(filter: DateFilterType): DateRange {
  const now = new Date();
  let startDate: string | null = null;
  let endDate: string | null = null;

  switch (filter) {
    case 'D':
      // Today
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      endDate = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      break;
    
    case 'W':
      // Last 7 days
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      endDate = now.toISOString();
      break;
    
    case 'M':
      // This month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      endDate = now.toISOString();
      break;
    
    case 'Y':
      // This year
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      endDate = now.toISOString();
      break;
    
    case 'A':
    default:
      // All time (no filter)
      startDate = null;
      endDate = null;
      break;
  }

  return { startDate, endDate };
}

/**
 * Apply date filter to Supabase query
 * @param query - Supabase query builder
 * @param filter - Filter type
 * @returns Modified query
 */
export function applyDateFilter<T extends { gt: (column: string, value: string) => any }>(
  query: T,
  filter: DateFilterType,
  column: string = 'created_at'
): T {
  const { startDate } = getDateRange(filter);
  if (startDate) {
    return query.gt(column, startDate);
  }
  return query;
}
