'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseHomeSearchStateOptions {
  hasSearch: boolean;
  searchQuery: string;
  searchLoading: boolean;
  postsLength: number;
}

/**
 * แยกสถานะรอผลค้นหาออกจากหน้า Home:
 * - ระหว่างค้นหาและยังไม่มีรายการ = แสดง skeleton
 * - ค้นหาเสร็จแล้วแต่ไม่มีรายการ = แสดง empty state
 */
export function useHomeSearchState(options: UseHomeSearchStateOptions) {
  const { hasSearch, searchQuery, searchLoading, postsLength } = options;

  const prevSearchQueryRef = useRef<string>('');
  const prevSearchLoadingRef = useRef(false);
  const prevQueryForEmptyRef = useRef<string>('');
  const [searchResolvedForEmpty, setSearchResolvedForEmpty] = useState(false);

  useEffect(() => {
    if (!hasSearch) {
      prevSearchQueryRef.current = '';
      prevSearchLoadingRef.current = false;
      prevQueryForEmptyRef.current = '';
      setSearchResolvedForEmpty(false);
      return;
    }

    if (searchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = searchQuery;
      prevSearchLoadingRef.current = false;
      prevQueryForEmptyRef.current = searchQuery;
      setSearchResolvedForEmpty(false);
      return;
    }

    const wasLoading = prevSearchLoadingRef.current;
    prevSearchLoadingRef.current = searchLoading;
    if (wasLoading && !searchLoading) {
      setSearchResolvedForEmpty(true);
    }
  }, [hasSearch, searchQuery, searchLoading]);

  useEffect(() => {
    if (!hasSearch) return;
    if (prevQueryForEmptyRef.current !== searchQuery) {
      prevQueryForEmptyRef.current = searchQuery;
      setSearchResolvedForEmpty(false);
    }
  }, [hasSearch, searchQuery]);

  const searchWaitingResults = hasSearch && postsLength === 0 && !searchResolvedForEmpty;

  return {
    searchResolvedForEmpty,
    searchWaitingResults,
  };
}
