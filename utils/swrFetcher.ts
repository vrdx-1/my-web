/**
 * SWR Fetcher Utility
 * Provides a consistent way to fetch data for SWR caching
 */

/**
 * Generic fetcher for SWR
 * Handles API routes and direct Supabase queries
 * @param key - The SWR key (URL string or array)
 * @returns The fetched data
 */
export async function swrFetcher(key: string | string[]): Promise<any> {
  // Handle string keys (API routes)
  if (typeof key === 'string') {
    // If it's an API route, fetch it
    if (key.startsWith('/api/')) {
      const response = await fetch(key);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      return response.json();
    }
  }
  
  // Handle array keys (for complex queries)
  if (Array.isArray(key)) {
    const [table, ...params] = key;
    
    // Handle different query types
    if (table === 'posts') {
      const [startIndex, endIndex, searchTerm] = params;
      // Convert to API route for consistency
      const url = searchTerm && searchTerm !== 'null'
        ? `/api/posts?startIndex=${startIndex}&endIndex=${endIndex}&searchTerm=${encodeURIComponent(searchTerm)}`
        : `/api/posts?startIndex=${startIndex}&endIndex=${endIndex}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    }
  }
  
  // Default: return null for unknown keys
  return null;
}

/**
 * Fetcher for post details by IDs
 */
export async function fetchPostsByIds(postIds: string[]): Promise<any[]> {
  if (postIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('cars')
    .select('id, caption, province, images, status, created_at, is_boosted, is_hidden, user_id, views, likes, saves, shares, profiles!cars_user_id_fkey(username, avatar_url, phone, last_seen)')
    .in('id', postIds)
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}
