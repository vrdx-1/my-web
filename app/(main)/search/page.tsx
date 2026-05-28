'use client';

import React, { Suspense, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCarDictionarySuggestions } from '@/utils/postUtils';
import { getOrCreateGuestToken } from '@/utils/guestToken';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { mergeHeaders } from '@/utils/activeProfile';

type SuggestionItem = { display: string; searchKey: string; type?: 'year' | 'dictionary' };
type SearchHistoryItem = {
  search_term: string;
  display_text: string | null;
  last_searched_at: string;
};

type HistoryStatus = 'idle' | 'loading' | 'loaded';
type SuggestionsPagination = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  nextPage: number | null;
};

const SEARCH_HEADER_HEIGHT = 66;

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, activeProfileId, sessionReady, startSessionCheck } = useSessionAndProfile();
  const qFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(() => qFromUrl);
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('idle');
  const [yearSuggestions, setYearSuggestions] = useState<string[]>([]);
  const [loadingYearSuggestions, setLoadingYearSuggestions] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsSentinelRef = useRef<HTMLDivElement | null>(null);

  /** ซิงก์คำค้นกับ URL (แก้กรณี guest หรือ client nav ที่ state เริ่มต้นไม่ตรงกับ ?q=) */
  useEffect(() => {
    setQuery((prev) => (prev !== qFromUrl ? qFromUrl : prev));
  }, [qFromUrl]);

  const loadSuggestionPage = useCallback(async (q: string, page: number, append: boolean) => {
    const qTrim = q.trim();
    if (!qTrim) {
      setYearSuggestions([]);
      setSuggestionsPage(1);
      setSuggestionsHasMore(false);
      return;
    }

    try {
      if (append) {
        setLoadingMoreSuggestions(true);
      } else {
        setLoadingYearSuggestions(true);
      }

      const response = await fetch(
        `/api/posts/search/suggestions?q=${encodeURIComponent(qTrim)}&page=${page}&pageSize=200`
      );
      const data = await response.json();
      const apiSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      const pagination = (data?.pagination ?? null) as SuggestionsPagination | null;
      const hasMore = !!pagination?.hasMore;
      const nextPage = pagination?.nextPage ?? null;

      setYearSuggestions((prev) => {
        if (!append) return apiSuggestions;
        const merged = [...prev, ...apiSuggestions];
        return merged.filter((item, index, arr) => arr.indexOf(item) === index);
      });

      if (hasMore && typeof nextPage === 'number') {
        setSuggestionsPage(nextPage);
      }
      setSuggestionsHasMore(hasMore);
    } catch (err) {
      console.error('Failed to fetch year suggestions:', err);
      if (!append) {
        setYearSuggestions([]);
        setSuggestionsHasMore(false);
      }
    } finally {
      setLoadingYearSuggestions(false);
      setLoadingMoreSuggestions(false);
    }
  }, []);

  // Fetch first page suggestions from API.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setYearSuggestions([]);
      setSuggestionsPage(1);
      setSuggestionsHasMore(false);
      return;
    }

    const timer = setTimeout(() => {
      void loadSuggestionPage(q, 1, false);
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [query, loadSuggestionPage]);

  // Infinite load for suggestions when scrolling to the bottom.
  useEffect(() => {
    const shouldShowSuggestions = query.trim().length > 0;
    if (!shouldShowSuggestions || !suggestionsHasMore || loadingMoreSuggestions || loadingYearSuggestions) return;

    const node = suggestionsSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingMoreSuggestions || loadingYearSuggestions) return;
        void loadSuggestionPage(query, suggestionsPage, true);
      },
      { root: null, rootMargin: '0px 0px 320px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    query,
    suggestionsHasMore,
    loadingMoreSuggestions,
    loadingYearSuggestions,
    loadSuggestionPage,
    suggestionsPage,
  ]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (q.length === 0) return [];
    const dictionarySuggestions = getCarDictionarySuggestions(q, Number.MAX_SAFE_INTEGER);

    const combined: SuggestionItem[] = [];
    const seenKeys = new Set<string>();

    const pushIfUnique = (item: SuggestionItem) => {
      const key = `${item.display}`.trim().toLowerCase();
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      combined.push(item);
    };

    // Keep brand/model overview at the top.
    for (const dictSug of dictionarySuggestions) {
      pushIfUnique({
        display: dictSug.display,
        searchKey: dictSug.searchKey,
        type: 'dictionary',
      });
    }

    // Then append API suggestions (year + feature groups) in server-ranked order.
    for (const yearSug of yearSuggestions) {
      pushIfUnique({
        display: yearSug,
        searchKey: yearSug,
        type: 'year',
      });
    }

    return combined;
  }, [query, yearSuggestions]);

  const loadHistory = useCallback(async () => {
    if (!sessionReady) return;
    setHistoryStatus('loading');
    try {
      const accessToken = session?.access_token ?? '';
        const guestToken = !session?.user ? getOrCreateGuestToken() : '';
      if (guestToken) {
        // DEBUG: log guestToken before API call
        console.log('[DEBUG] guestToken sent to /api/search/history:', guestToken);
      }
      const response = await fetch('/api/search/history?limit=20', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: mergeHeaders(
          {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(guestToken ? { 'x-guest-token': guestToken } : {}),
          },
          activeProfileId,
        ),
      });
      const payload = await response.json().catch(() => ({ items: [] }));
      if (!response.ok) {
        setHistoryItems([]);
        setHistoryStatus('loaded');
        return;
      }
      setHistoryItems(Array.isArray(payload?.items) ? payload.items : []);
      setHistoryStatus('loaded');
    } catch {
      setHistoryItems([]);
      setHistoryStatus('loaded');
    }
  }, [activeProfileId, session, sessionReady]);

  // เรียก startSessionCheck ทันทีที่ mount เพื่อไม่ต้องรอ 3 วิ
  // สำคัญสำหรับ Guest ที่เปิดหน้า /search โดยตรง (sessionReady จะเป็น false ตลอด 3 วิ ถ้าไม่เรียก)
  useEffect(() => {
    startSessionCheck();
  }, [startSessionCheck]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useLayoutEffect(() => {
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    // focus ทันที (synchronous) เพื่อรับช่วง keyboard จาก temp input ที่ถูก focus ใน gesture context บน iOS
    focusInput();
    // rAF สำรองสำหรับกรณี input ยังไม่พร้อมใน layout pass แรก
    const rafId = requestAnimationFrame(focusInput);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const commitSearch = useCallback(
    async (term: string, searchType: 'manual' | 'suggestion' | 'history' = 'manual') => {
      const t = term.trim();
      if (t) {
        const accessToken = session?.access_token ?? '';
        const guestToken = !session?.user ? getOrCreateGuestToken() : '';
        await fetch('/api/search/log', {
          method: 'POST',
          credentials: 'include',
          headers: mergeHeaders(
            {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              ...(guestToken ? { 'x-guest-token': guestToken } : {}),
            },
            activeProfileId,
          ),
          body: JSON.stringify({
            search_term: t,
            search_type: searchType,
            guest_token: guestToken || undefined,
          }),
        }).catch(() => {});
        await loadHistory();
      }
      router.push(t ? `/home?q=${encodeURIComponent(t)}` : '/home', { scroll: false });
    },
    [activeProfileId, loadHistory, router, session],
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
    (item: SuggestionItem) => {
      // ใช้ display เพื่อให้ข้อความที่แสดงด้านบนตรงกับภาษาที่ผู้ใช้กด (เช่น ລົດເກັງ ไม่กลายเป็น sedan) logic การค้นหายังเหมือนเดิม
      commitSearch(item.display, 'suggestion');
    },
    [commitSearch],
  );

  const handleHistoryClick = useCallback(
    (item: SearchHistoryItem) => {
      commitSearch(item.search_term, 'history');
    },
    [commitSearch],
  );

  const handleRemoveHistoryItem = useCallback(
    async (item: SearchHistoryItem) => {
      try {
        const accessToken = session?.access_token ?? '';
        const guestToken = !session?.user ? getOrCreateGuestToken() : '';
        await fetch('/api/search/history', {
          method: 'DELETE',
          credentials: 'include',
          headers: mergeHeaders(
            {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              ...(guestToken ? { 'x-guest-token': guestToken } : {}),
            },
            activeProfileId,
          ),
          body: JSON.stringify({
            search_term: item.search_term,
            guest_token: guestToken || undefined,
          }),
        });
      } catch {
        // ignore
      } finally {
        setHistoryItems((prev) => prev.filter((entry) => entry.search_term !== item.search_term));
      }
    },
    [activeProfileId, session],
  );

  const showSuggestions = query.trim().length > 0;
  const showHistory = query.trim().length === 0 && historyItems.length > 0;
  const showHistoryLoading = query.trim().length === 0 && historyStatus === 'loading';
  const showHistoryEmpty = query.trim().length === 0 && historyStatus === 'loaded' && historyItems.length === 0;

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
          padding: '16px 12px 10px 8px',
          borderBottom: 'none',
          background: '#fff',
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER.maxWidth,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (query.trim().length === 0) {
              router.push('/home', { scroll: false });
            } else {
              router.back();
            }
          }}
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
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 13,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={inputRef}
            autoFocus
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
              paddingLeft: 37,
              paddingRight: query.trim().length > 0 ? 34 : 16,
              fontSize: '16px',
              border: '1px solid #d0d5dd',
              borderRadius: 20,
              background: '#ffffff',
              color: '#101828',
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
                right: 12,
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                background: '#bcc3cf',
                color: '#ffffff',
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
          onClick={() => commitSearch(query, 'manual')}
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

      <div style={{ height: SEARCH_HEADER_HEIGHT }} aria-hidden />

      {(showSuggestions || showHistory || showHistoryLoading || showHistoryEmpty) && (
        <div style={{ background: '#fff', minHeight: 200 }}>
          {showSuggestions && (
            <>
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
              {loadingMoreSuggestions && <div style={{ minHeight: 16 }} />}
              {suggestionsHasMore && <div ref={suggestionsSentinelRef} style={{ height: 1 }} aria-hidden />}
            </>
          )}
          {showHistoryLoading && (
            <div style={{ minHeight: 12 }} />
          )}
          {showHistory && (
            <div style={{ padding: '8px 0' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {historyItems.map((item, i) => (
                  <li key={`${item.search_term}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
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
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.display_text || item.search_term}
                      </span>
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
          {showHistoryEmpty && <div style={{ minHeight: 12 }} />}
        </div>
      )}

    </main>
  );
}

function SearchPageFallback() {
  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div
        style={{
          padding: '10px 12px 10px 8px',
          borderBottom: 'none',
          background: '#fff',
          minHeight: 56,
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER.maxWidth,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div style={{ width: 36, height: 36, flexShrink: 0 }} />
        <div style={{ flex: 1, height: 40, borderRadius: 20, background: '#fff', border: '1px solid #d0d5dd' }} />
        <div style={{ width: 72, height: 40, borderRadius: 20, background: '#e4e6eb' }} />
      </div>

      <div style={{ height: SEARCH_HEADER_HEIGHT }} aria-hidden />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}
