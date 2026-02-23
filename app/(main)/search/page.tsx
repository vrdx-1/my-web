'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getCarDictionarySuggestions } from '@/utils/postUtils';
import { getSearchHistory, addSearchHistory, removeSearchHistoryItem } from '@/utils/searchHistory';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const SUGGESTION_LIMIT = 15;

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [historyItems, setHistoryItems] = useState<string[]>([]);

  useEffect(() => {
    setHistoryItems(getSearchHistory());
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (q.length === 0) return [];
    return getCarDictionarySuggestions(q, SUGGESTION_LIMIT);
  }, [query]);

  const commitSearch = useCallback(
    (term: string) => {
      const t = term.trim();
      if (t) {
        addSearchHistory(t);
        setHistoryItems(getSearchHistory());
      }
      router.push(t ? `/home?q=${encodeURIComponent(t)}` : '/home', { scroll: false });
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      commitSearch(query);
    },
    [query, commitSearch],
  );

  const handleSuggestionClick = useCallback(
    (item: { display: string; searchKey: string }) => {
      commitSearch(item.searchKey);
    },
    [commitSearch],
  );

  const handleHistoryClick = useCallback(
    (item: string) => {
      commitSearch(item);
    },
    [commitSearch],
  );

  const handleRemoveHistoryItem = useCallback((item: string) => {
    removeSearchHistoryItem(item);
    setHistoryItems(getSearchHistory());
  }, []);

  const showSuggestions = query.trim().length > 0;
  const showHistory = query.trim().length === 0 && historyItems.length > 0;

  const highlightMatch = (display: string, q: string) => {
    const qTrim = q.trim();
    if (!qTrim) return display;
    const lower = display.toLowerCase();
    const i = lower.indexOf(qTrim.toLowerCase());
    if (i < 0) return display;
    const before = display.slice(0, i);
    const match = display.slice(i, i + qTrim.length);
    const after = display.slice(i + qTrim.length);
    return (
      <>
        {before}
        <span style={{ fontWeight: 700, color: '#111' }}>{match}</span>
        {after}
      </>
    );
  };

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div
        style={{
          padding: '10px 12px 10px 8px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: '#000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label="Back"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            inputMode="search"
            placeholder="ຄົ້ນຫາ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              paddingLeft: 16,
              paddingRight: query.trim().length > 0 ? 34 : 16,
              fontSize: '16px',
              border: 'none',
              borderRadius: 20,
              background: '#e4e6eb',
              color: '#000',
              fontFamily: LAO_FONT,
              boxSizing: 'border-box',
              outline: 'none',
            }}
            aria-label="Search"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear"
              style={{
                position: 'absolute',
                right: 6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                background: '#65676b',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => commitSearch(query)}
          style={{
            flexShrink: 0,
            height: 40,
            padding: '0 16px',
            borderRadius: 20,
            border: 'none',
            background: '#1877f2',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: LAO_FONT,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ຄົ້ນຫາ
        </button>
      </div>

      {(showSuggestions || showHistory) && (
        <div style={{ background: '#fff', minHeight: 200 }}>
          {showSuggestions && (
            <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
              {suggestions.map((item, i) => (
                <li key={`${item.searchKey}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(item)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      border: 'none',
                      background: 'none',
                      fontSize: '16px',
                      fontFamily: LAO_FONT,
                      color: '#111',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span style={{ flexShrink: 0, color: '#65676b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {highlightMatch(item.display, query)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showHistory && (
            <div style={{ padding: '8px 0' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {historyItems.map((item, i) => (
                  <li key={`${item}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleHistoryClick(item)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        fontSize: '16px',
                        fontFamily: LAO_FONT,
                        color: '#111',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ flexShrink: 0, color: '#65676b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveHistoryItem(item);
                      }}
                      aria-label="ລົບ"
                      style={{
                        flexShrink: 0,
                        width: 36,
                        height: 36,
                        marginRight: 8,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: '#65676b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

    </main>
  );
}
