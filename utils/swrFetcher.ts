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
      const [startIndex, endIndex] = params;
      const url = `/api/posts?startIndex=${startIndex}&endIndex=${endIndex}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    }
  }
  
  // Default: return null for unknown keys
  return null;
}
