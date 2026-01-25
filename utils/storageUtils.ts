/**
 * Storage Utilities
 * Safe localStorage/sessionStorage operations with error handling
 */

/**
 * Safely parse JSON from localStorage
 * Returns default value if parsing fails
 */
export function safeParseJSON<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error parsing localStorage key "${key}":`, error);
    // Clear corrupted data
    localStorage.removeItem(key);
    return defaultValue;
  }
}

/**
 * Safely parse JSON from sessionStorage
 * Returns default value if parsing fails
 */
export function safeParseSessionJSON<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error parsing sessionStorage key "${key}":`, error);
    // Clear corrupted data
    sessionStorage.removeItem(key);
    return defaultValue;
  }
}
