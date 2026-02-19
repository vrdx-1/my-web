'use client'

import React, { useState, useEffect, useRef } from 'react';
import { LAO_FONT } from '@/utils/constants';
import { LAO_PROVINCES } from '@/utils/constants';
import { getCarDictionarySuggestions } from '@/utils/postUtils';
import {
  loadSearchHistory,
  saveSearchToHistory,
  removeSearchFromHistory,
  clearSearchHistory,
  logSearchToSupabase,
  type SearchHistoryItem,
} from '@/utils/storageUtils';

interface SearchScreenProps {
  isOpen: boolean;
  /** ค่าแสดงในช่องค้นหา (ข้อความที่ user เห็นในแท็บ) */
  searchTerm: string;
  /** ค่าที่ส่งไป API — ใช้เมื่อยกเลิกเพื่อคืน state ให้ตรงกับก่อนเปิด */
  initialApiTerm?: string;
  /** value = ค่าส่งไป API, displayText = ค่าแสดงในแท็บ/ช่องค้นหา (ถ้าไม่ใส่ใช้ value) */
  onSearchChange: (value: string, displayText?: string) => void;
  onClose: () => void;
  /** เรียกเมื่อผู้ใช้กดส่งคำค้นหรือกด suggestion (ให้ refresh ฝั่งพร้อมขายทันที) */
  onSearchPerform?: () => void;
}

const STOP_TOKENS = new Set([
  // Thai
  'ขาย',
  'มือสอง',
  'ไมล์',
  'ดาวน์',
  // Lao
  'ຂາຍ',
  'ມືສອງ',
  'ໃໝ່',
  // English
  'sale',
  'used',
  'new',
]);

function renderHighlighted(text: string, query: string) {
  const q = (query ?? '').trim();
  if (!q) return text;

  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx !== 0) return text; // autocomplete: only when suggestion starts with typed query

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span style={{ fontWeight: 700, color: '#111111' }}>{match}</span>
      <span style={{ opacity: 0.65, color: '#111111' }}>{after}</span>
    </>
  );
}

function normalizeForPrefix(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function suggestionToSearchTerm(suggestion: string): string {
  // Guarantee that clicking a suggestion yields results:
  // Use the first meaningful token (usually brand/model) rather than the full phrase,
  // because the displayed suggestion may be a re-ordered/condensed caption snippet.
  const parts = String(suggestion ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0];
  return first || '';
}

function extractImportantTokensFromCaption(caption: string): { tokens: string[] } {
  const raw = String(caption ?? '').trim();
  if (!raw) return { tokens: [] };

  // Keep only word-ish parts; remove obvious noise.
  const tokens = raw
    .replace(/[()[\]{}"“”'‘’]/g, ' ')
    .replace(/[.,;:!/?\\|@#$%^&*_+=~`<>-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/^#+|#+$/g, '')); // strip hashtags edges

  const important: string[] = [];

  for (const token of tokens) {
    if (!token) continue;
    const lower = token.toLowerCase();

    // Skip provinces/locations (keep suggestions about car identity, not place)
    if ((LAO_PROVINCES as readonly string[]).includes(token as any)) continue;

    // Skip obvious stop words
    if (STOP_TOKENS.has(token) || STOP_TOKENS.has(lower)) continue;

    // Skip phone-like numbers
    if (/^\+?\d{7,}$/.test(token.replace(/[-\s]/g, ''))) continue;

    // Skip price-ish tokens (very rough)
    if (/[฿$€₭]/.test(token)) continue;
    if (/\d/.test(token) && /(k|K|m|M|ล้าน|ລ້ານ|kip|ກີບ|baht|ບາດ)/i.test(token)) continue;

    // Skip pure numbers (years/prices/phones should not appear in suggestions)
    if (/^\d+$/.test(token)) continue;

    // Keep tokens that look like words (any script) and are not too short
    if (token.length < 2) continue;

    important.push(token);
    if (important.length >= 3) break; // brand + model + maybe trim
  }

  return { tokens: important };
}

function buildAutocompleteSuggestionFromCaption(
  caption: string,
  queryPrefix: string,
): string | null {
  const q = normalizeForPrefix(queryPrefix);
  if (!q) return null;

  const { tokens } = extractImportantTokensFromCaption(caption);
  if (tokens.length === 0) return null;

  const qParts = q.split(' ').filter(Boolean);

  // Build a candidate suggestion that STARTS with what the user typed (global autocomplete feel).
  // Try matching from each token boundary (brand/model/year...), then "rotate" to start there.
  for (let start = 0; start < tokens.length; start++) {
    const tail = tokens.slice(start, Math.min(tokens.length, start + 3)); // show up to 3 key tokens
    let candidate = tail.join(' ').trim();

    const candNorm = normalizeForPrefix(candidate);

    if (q && candNorm.startsWith(q)) {
      return candidate;
    }

    // Also allow matching the first token only (common while user types the first word)
    // Example: user types "re" and candidate starts with "revo ..." (handled above),
    // but if user types just "r" we still want a good completion.
    const firstTokNorm = normalizeForPrefix(tokens[start]);
    if (q && q.length >= 1 && firstTokNorm.startsWith(q)) {
      return candidate;
    }
  }

  return null;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  isOpen,
  searchTerm,
  initialApiTerm = '',
  onSearchChange,
  onClose,
  onSearchPerform,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; searchKey: string }>>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const suggestionReqIdRef = useRef(0);
  const initialDisplayRef = useRef<string>('');
  const initialApiTermRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      initialDisplayRef.current = searchTerm;
      initialApiTermRef.current = initialApiTerm;
      // Load search history when search screen opens
      setSearchHistory(loadSearchHistory());
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchTerm, initialApiTerm]);

  const handleCancelSearch = () => {
    onSearchChange(initialApiTermRef.current || '', initialDisplayRef.current || '');
    onClose();
  };

  // Load search suggestions from car dictionary (brand / model / category only).
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      return;
    }

    const q = (searchTerm ?? '').trim();
    const dictSuggestions = getCarDictionarySuggestions(q, 9);

    const reqId = ++suggestionReqIdRef.current;
    const timer = setTimeout(() => {
      if (reqId !== suggestionReqIdRef.current) return;
      setSuggestions(dictSuggestions);
    }, 250); // small debounce while typing

    return () => clearTimeout(timer);
  }, [isOpen, searchTerm]);

  // Reload search history when search term changes (to update after deletion)
  useEffect(() => {
    if (isOpen) {
      setSearchHistory(loadSearchHistory());
    }
  }, [isOpen]);

  // Handle Escape key to close search screen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancelSearch();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTerm = searchTerm.trim();
    // ไม่มีคำค้น = แสดงทุกโพสต์เหมือนเพิ่งเข้าเว็บครั้งแรก
    if (!trimmedTerm) {
      onSearchChange('');
    } else {
      // Save to search history (localStorage)
      saveSearchToHistory(trimmedTerm, trimmedTerm);
      setSearchHistory(loadSearchHistory());
      // บันทึกลง Supabase สำหรับ Admin ดูสถิติ
      logSearchToSupabase(trimmedTerm, trimmedTerm, 'manual');
    }
    onSearchPerform?.();
    onClose();
  };

  const handleSuggestionClick = (searchKey: string, displayText: string) => {
    // Save to search history (localStorage)
    saveSearchToHistory(searchKey, displayText);
    setSearchHistory(loadSearchHistory());
    // บันทึกลง Supabase สำหรับ Admin ดูสถิติ
    logSearchToSupabase(searchKey, displayText, 'suggestion');
    onSearchChange(searchKey, displayText);
    onSearchPerform?.();
    onClose();
  };

  const handleHistoryClick = (item: SearchHistoryItem) => {
    // Move clicked item to top of history
    saveSearchToHistory(item.term, item.displayText);
    setSearchHistory(loadSearchHistory());
    // บันทึกลง Supabase ทุกครั้งที่กดจากประวัติ (User กดค้นหาจากประวัติการค้นหา)
    logSearchToSupabase(item.term, item.displayText, 'history');
    onSearchChange(item.term, item.displayText);
    onSearchPerform?.();
    onClose();
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeSearchFromHistory(term);
    setSearchHistory(loadSearchHistory());
  };

  const handleClearAllHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: LAO_FONT,
      }}
    >
      {/* Header with Back Button and Search Input */}
      <div
        style={{
          padding: '12px 8px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {/* Back Button */}
        <button
          onClick={handleCancelSearch}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            touchAction: 'manipulation',
            padding: 0,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#f0f2f5',
              borderRadius: '20px',
              padding: '10px 18px',
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ຄົ້ນຫາ"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '16px',
                color: '#111111',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#c2c2c2',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  marginLeft: '8px',
                  flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            style={{
              background: '#1877f2',
              border: '1px solid #1877f2',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '20px',
              flexShrink: 0,
              touchAction: 'manipulation',
              opacity: 1,
            }}
          >
            ຄົ້ນຫາ
          </button>
        </form>
      </div>

      {/* Content Section */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Show suggestions when user is typing */}
        {suggestions.length > 0 && searchTerm.trim() && (
          <div style={{ paddingTop: '2px' }}>
            {suggestions.map((item, index) => (
              <div
                key={`suggest-${item.searchKey}-${item.display}-${index}`}
                onClick={() => handleSuggestionClick(item.searchKey, item.display)}
                style={{
                  padding: '12px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a4d52"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      color: '#000',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderHighlighted(item.display, searchTerm)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show search history when input is empty or user hasn't typed much */}
        {(!searchTerm.trim() || searchTerm.trim().length < 2) && searchHistory.length > 0 && (
          <div style={{ marginTop: '-18px' }}>
            {/* Header with "Recent Searches" and "Clear All" */}
            <div
              style={{
                padding: '0px 15px 10px 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#65676b',
                  letterSpacing: '0.2px',
                }}
              >
              </div>
              {searchHistory.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#1877f2',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    touchAction: 'manipulation',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f2f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                </button>
              )}
            </div>

            {/* History Items */}
            {searchHistory.map((item, index) => (
              <div
                key={`history-${item.term}-${item.timestamp}-${index}`}
                onClick={() => handleHistoryClick(item)}
                style={{
                  padding: '12px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Clock icon for history */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a4d52"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      color: '#000',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.displayText || item.term}
                  </div>
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveHistoryItem(e, item.term)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    padding: 0,
                    touchAction: 'manipulation',
                    opacity: 0.6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e4e6eb';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#65676b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state when no history and no suggestions */}
        {!searchTerm.trim() && searchHistory.length === 0 && suggestions.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: '#65676b',
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c2c2c2"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '16px' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 500 }}>
              ບໍ່ມີປະຫວັດການຄົ້ນຫາ
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
