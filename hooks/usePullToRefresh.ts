'use client';

import { useState, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  isLoading: boolean;
  onRefresh: () => Promise<void> | void;
}

export function usePullToRefresh({ isLoading, onRefresh }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: any) => {
    if (typeof window === 'undefined') return;
    if (window.scrollY === 0 && !isRefreshing && !isLoading) {
      if (e.touches && e.touches.length > 0) {
        pullStartYRef.current = e.touches[0].clientY;
        setIsPulling(true);
        setPullDistance(0);
      }
    } else {
      pullStartYRef.current = null;
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [isRefreshing, isLoading]);

  const handleTouchMove = useCallback((e: any) => {
    if (!isPulling || pullStartYRef.current === null) return;
    if (typeof window !== 'undefined' && window.scrollY > 0) {
      pullStartYRef.current = null;
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    if (!e.touches || e.touches.length === 0) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartYRef.current;
    if (diff <= 0) {
      setPullDistance(0);
      return;
    }
    const maxPull = 120;
    setPullDistance(Math.min(diff, maxPull));
  }, [isPulling]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) {
      setPullDistance(0);
      return;
    }
    const threshold = 70;
    const shouldRefresh = pullDistance >= threshold;
    setIsPulling(false);
    setPullDistance(0);
    if (shouldRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

