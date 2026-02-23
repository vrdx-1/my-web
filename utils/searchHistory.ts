/**
 * Search history — เก็บประวัติการค้นหาล่าสุด (localStorage), สูงสุด 20 รายการ
 */

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_ITEMS = 20;

export function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(term: string): void {
  const t = String(term ?? '').trim();
  if (!t) return;
  const list = getSearchHistory().filter((x) => x !== t);
  list.unshift(t);
  const trimmed = list.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function removeSearchHistoryItem(term: string): void {
  const t = String(term ?? '').trim();
  if (!t) return;
  const list = getSearchHistory().filter((x) => x !== t);
  try {
    if (list.length === 0) {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } else {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
}
