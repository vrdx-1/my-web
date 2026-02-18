import { supabase } from '@/lib/supabase';

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

/**
 * Search History Utilities
 * Manages user search history with localStorage
 */

export interface SearchHistoryItem {
  term: string;
  displayText?: string;
  timestamp: number;
}

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 15;

const GUEST_TOKEN_KEY = 'guest_token';
const GUEST_MIGRATION_PREFIX = 'search_logs_migrated_for_user_';

function generateGuestToken(): string {
  try {
    if (typeof window !== 'undefined' && 'crypto' in window && 'randomUUID' in window.crypto) {
      return (window.crypto as any).randomUUID();
    }
  } catch {
    // fallback ด้านล่าง
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

/**
 * Load search history from localStorage
 */
export function loadSearchHistory(): SearchHistoryItem[] {
  return safeParseJSON<SearchHistoryItem[]>(SEARCH_HISTORY_KEY, []);
}

/**
 * Save a search term to history
 */
export function saveSearchToHistory(term: string, displayText?: string): void {
  if (typeof window === 'undefined') return;
  
  const trimmedTerm = term.trim();
  if (!trimmedTerm) return;
  
  try {
    const history = loadSearchHistory();
    
    // Remove existing entry with same term (case-insensitive)
    const normalizedTerm = trimmedTerm.toLowerCase();
    const filtered = history.filter(
      (item) => item.term.toLowerCase() !== normalizedTerm
    );
    
    // Add new entry at the beginning
    const newItem: SearchHistoryItem = {
      term: trimmedTerm,
      displayText: displayText || trimmedTerm,
      timestamp: Date.now(),
    };
    
    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

/**
 * Remove a specific search term from history
 */
export function removeSearchFromHistory(term: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const history = loadSearchHistory();
    const normalizedTerm = term.toLowerCase();
    const filtered = history.filter(
      (item) => item.term.toLowerCase() !== normalizedTerm
    );
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing search from history:', error);
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing search history:', error);
  }
}

/**
 * Search Log Utilities
 * บันทึกการค้นหาลง Supabase สำหรับ Admin ดูสถิติ
 */

/**
 * บันทึกการค้นหาลง Supabase
 * @param term คำค้นหา
 * @param displayText ข้อความที่แสดง (ถ้ามี)
 * @param searchType ประเภทการค้นหา ('manual' หรือ 'suggestion')
 */
export async function logSearchToSupabase(
  term: string,
  displayText?: string,
  searchType: 'manual' | 'suggestion' = 'manual'
): Promise<void> {
  if (typeof window === 'undefined') return;

  const trimmedTerm = term.trim();
  if (!trimmedTerm) return;

  try {
    // ดึง user_id จาก client เดียวกับที่ใช้ล็อกอินในเว็บ
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;
    const guestToken = getOrCreateGuestToken();

    // บันทึกลง Supabase (ไม่ต้องรอผลลัพธ์ - fire and forget)
    supabase
      .from('search_logs')
      .insert({
        user_id: userId,
        guest_token: guestToken,
        search_term: trimmedTerm,
        display_text: displayText || trimmedTerm,
        search_type: searchType,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Error logging search to Supabase:', error);
        }
      });
  } catch (error) {
    // Silent fail - ไม่ให้กระทบ UX ถ้า Supabase มีปัญหา
    console.error('Error logging search to Supabase:', error);
  }
}

/**
 * ย้ายประวัติการค้นหาของ Guest (guest_token) ไปผูกกับ user_id หลังจากล็อกอิน/สมัครสำเร็จ
 */
export async function migrateGuestSearchLogsToUser(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const trimmedUserId = String(userId || '').trim();
  if (!trimmedUserId) return;

  try {
    const migrationKey = `${GUEST_MIGRATION_PREFIX}${trimmedUserId}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);
    if (alreadyMigrated === '1') return;

    const guestToken = getGuestToken();
    if (!guestToken) {
      localStorage.setItem(migrationKey, '1');
      return;
    }

    const { error } = await supabase
      .from('search_logs')
      .update({ user_id: trimmedUserId })
      .eq('guest_token', guestToken)
      .is('user_id', null);

    if (error) {
      console.error('Error migrating guest search logs to user:', error);
      return;
    }

    localStorage.setItem(migrationKey, '1');
  } catch (error) {
    console.error('Error migrating guest search logs to user:', error);
  }
}
