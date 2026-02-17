import { useRef, useCallback, RefObject, useEffect } from 'react';
import { FEED_PRELOAD_ROOT_MARGIN, FEED_PRELOAD_THRESHOLD } from '@/utils/constants';

interface UseInfiniteScrollProps {
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
  rootMargin?: string;
  /** เมื่อมี scroll อยู่ใน container (เช่น overflowY: auto) ต้องส่ง ref ของ container นี้เป็น root เพื่อให้โหลดเพิ่มเมื่อเลื่อนถึงล่าง container */
  rootRef?: RefObject<HTMLElement | null>;
}

/**
 * Infinite scroll with world-class preloading (Facebook/Instagram-style).
 * Triggers load more when the sentinel is still 800px below viewport so next page is ready before user reaches bottom.
 */
export const useInfiniteScroll = ({
  loadingMore,
  hasMore,
  onLoadMore,
  threshold = FEED_PRELOAD_THRESHOLD,
  rootMargin = FEED_PRELOAD_ROOT_MARGIN,
  rootRef,
}: UseInfiniteScrollProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const lastElementRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    if (!node) return;
    const root = rootRef?.current ?? undefined;
    observer.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        requestAnimationFrame(() => onLoadMoreRef.current());
      },
      { threshold, rootMargin, root }
    );
    observer.current.observe(node);
  }, [threshold, rootMargin, rootRef]);

  useEffect(() => {
    if (loadingMore || !hasMore) return;
    const node = nodeRef.current;
    if (!node) return;
    const root = rootRef?.current ?? undefined;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        requestAnimationFrame(() => onLoadMoreRef.current());
      },
      { threshold, rootMargin, root }
    );
    observer.current.observe(node);
    return () => {
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
    };
  }, [loadingMore, hasMore, threshold, rootMargin, rootRef]);

  return { lastElementRef };
};
