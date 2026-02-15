'use client'

import { useEffect, useRef, startTransition } from 'react';

/**
 * Custom hook สำหรับจัดการ effects ในหน้า Home
 * รวม effects ที่เกี่ยวข้องกันเพื่อลดความซับซ้อน
 */
export function useHomeEffects({
  loadingMore,
  setTabRefreshing,
  setHasInitialFetchCompleted,
  setRefreshSource,
}: {
  loadingMore: boolean;
  setTabRefreshing: (refreshing: boolean) => void;
  setHasInitialFetchCompleted: (completed: boolean) => void;
  setRefreshSource?: (source: 'pull' | 'tab' | null) => void;
}) {
  const initialFetchStartedRef = useRef(false);

  // ใส่ data-page="home" เพื่อให้ CSS ซ่อน scrollbar เฉพาะหน้าโฮม (รวมถึง iOS)
  useEffect(() => {
    document.body.setAttribute('data-page', 'home');
    return () => document.body.removeAttribute('data-page');
  }, []);

  // Use startTransition for non-urgent updates และจัดการ initial fetch state
  useEffect(() => {
    if (!initialFetchStartedRef.current && loadingMore) {
      initialFetchStartedRef.current = true;
    }
    
    if (!loadingMore) {
      startTransition(() => {
        setTabRefreshing(false);
        setRefreshSource?.(null);
        if (initialFetchStartedRef.current) {
          setHasInitialFetchCompleted(true);
        }
      });
    }
  }, [loadingMore, setTabRefreshing, setHasInitialFetchCompleted, setRefreshSource]);
}
