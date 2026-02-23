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
    sessionStorage.removeItem(key);
    return defaultValue;
  }
}

const GUEST_TOKEN_KEY = 'guest_token';

function generateGuestToken(): string {
  try {
    if (typeof window !== 'undefined' && 'crypto' in window && 'randomUUID' in window.crypto) {
      return (window.crypto as any).randomUUID();
    }
  } catch {
    // fallback
  }
  return `guest_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getGuestToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(GUEST_TOKEN_KEY);
    return existing && existing.trim() ? existing : null;
  } catch {
    return null;
  }
}

export function getOrCreateGuestToken(): string {
  if (typeof window === 'undefined') return generateGuestToken();
  try {
    const existing = localStorage.getItem(GUEST_TOKEN_KEY);
    if (existing && existing.trim()) return existing;
    const token = generateGuestToken();
    localStorage.setItem(GUEST_TOKEN_KEY, token);
    return token;
  } catch {
    return generateGuestToken();
  }
}
