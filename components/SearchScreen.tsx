'use client'

import React, { useState, useEffect, useRef } from 'react';
import { LAO_FONT } from '@/utils/constants';
import { supabase } from '@/lib/supabase';
import { LAO_PROVINCES } from '@/utils/constants';
import { getCarDictionarySuggestions } from '@/utils/postUtils';

interface SearchScreenProps {
  isOpen: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
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
      <span style={{ fontWeight: 700 }}>{match}</span>
      <span style={{ opacity: 0.65 }}>{after}</span>
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
  onSearchChange,
  onClose,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; searchKey: string }>>([]);
  const suggestionReqIdRef = useRef(0);
  const initialSearchTermRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      // Capture initial value so "back" can cancel edits (no search + clear typed changes).
      initialSearchTermRef.current = searchTerm;
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleCancelSearch = () => {
    onSearchChange(initialSearchTermRef.current || '');
    onClose();
  };

  // Load suggestion examples from caption (only).
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      return;
    }

    const q = (searchTerm ?? '').trim();
    const dictSuggestions = getCarDictionarySuggestions(q, 6);

    const reqId = ++suggestionReqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        let query = supabase
          .from('cars')
          .select('caption')
          .eq('status', 'recommend')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(250);

        const { data, error } = await query;
        if (reqId !== suggestionReqIdRef.current) return; // stale
        if (error || !data) {
          setSuggestions(dictSuggestions);
          return;
        }

        const uniq: Array<{ display: string; searchKey: string }> = [...dictSuggestions];
        const qPrefix = normalizeForPrefix(q);

        const qParts = qPrefix.split(' ').filter(Boolean);

        if (!qPrefix) {
          // When empty input: show general suggestions (no recent list).
          const counts = new Map<string, number>();
          for (const row of data as any[]) {
            const caption = String(row.caption ?? '').trim();
            if (!caption) continue;
            const { tokens } = extractImportantTokensFromCaption(caption);
            if (!tokens || tokens.length === 0) continue;
            const candidate = tokens.slice(0, 3).join(' ').trim();
            if (!candidate) continue;
            counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
          }
          const ranked = [...counts.entries()]
            .sort((a, b) => (b[1] - a[1]) || a[0].length - b[0].length || a[0].localeCompare(b[0]))
            .map(([k]) => k);
          for (const s of ranked) {
            const item = { display: s, searchKey: suggestionToSearchTerm(s) || s };
            const exists = uniq.some((u) => normalizeForPrefix(u.display) === normalizeForPrefix(item.display));
            if (!exists) uniq.push(item);
            if (uniq.length >= 6) break;
          }
        } else {
          // Build "completion style" suggestions from caption only.
          const scored = [...data]
            .map((d: any) => String(d.caption ?? '').trim())
            .filter(Boolean)
            .map((caption) => {
              const suggestion = buildAutocompleteSuggestionFromCaption(caption, qPrefix);
              if (!suggestion) return null;
              const sNorm = normalizeForPrefix(suggestion);
              const starts =
                (qPrefix && sNorm.startsWith(qPrefix)) ? 1 : 0;
              const wordCount = sNorm.split(' ').filter(Boolean).length;
              const exactWords =
                qParts.length > 1 && starts ? 1 : 0; // when user typed multiple words and we match at start
              // Prefer:
              // - startsWith query
              // - matching multi-word prefixes
              // - shorter completions (like global autocomplete)
              const score = starts * 3 + exactWords * 2 + (1 / Math.max(1, wordCount));
              return { suggestion, score, len: suggestion.length };
            })
            .filter(Boolean) as Array<{ suggestion: string; score: number; len: number }>;

          scored.sort((a, b) => (b.score - a.score) || (a.len - b.len) || a.suggestion.localeCompare(b.suggestion));

          for (const item of scored) {
            const sug = { display: item.suggestion, searchKey: suggestionToSearchTerm(item.suggestion) || item.suggestion };
            const exists = uniq.some((u) => normalizeForPrefix(u.display) === normalizeForPrefix(sug.display));
            if (!exists) uniq.push(sug);
            if (uniq.length >= 6) break;
          }
        }

        setSuggestions(uniq);
      } catch (e) {
        if (reqId !== suggestionReqIdRef.current) return;
        setSuggestions(dictSuggestions);
      }
    }, 250); // small debounce while typing

    return () => clearTimeout(timer);
  }, [isOpen, searchTerm]);

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
    if (searchTerm.trim()) {
      onClose();
    }
  };

  const handleSuggestionClick = (searchKey: string) => {
    onSearchChange(searchKey);
    onClose();
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
            disabled={!searchTerm.trim()}
            style={{
              background: searchTerm.trim() ? '#1877f2' : '#e4e6eb',
              border: searchTerm.trim() ? '1px solid #1877f2' : '1px solid #e4e6eb',
              color: searchTerm.trim() ? '#fff' : '#8a8d91',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: searchTerm.trim() ? 'pointer' : 'not-allowed',
              padding: '8px 16px',
              borderRadius: '20px',
              flexShrink: 0,
              touchAction: 'manipulation',
              opacity: searchTerm.trim() ? 1 : 0.6,
            }}
          >
            ຄົ້ນຫາ
          </button>
        </form>
      </div>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ paddingTop: '6px' }}>
              {suggestions.map((item) => (
                <div
                  key={`suggest-${item.searchKey}-${item.display}`}
                  onClick={() => handleSuggestionClick(item.searchKey)}
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
        </div>
      )}
    </div>
  );
};
