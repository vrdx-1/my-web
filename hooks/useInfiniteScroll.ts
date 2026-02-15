import { useRef, useCallback, RefObject, useEffect } from 'react';

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
 * Custom hook for infinite scroll functionality
 * Uses Intersection Observer API for better performance
 */
export const useInfiniteScroll = ({
  loadingMore,
  hasMore,
  onLoadMore,
  threshold = 0.1,
  rootMargin = '400px',
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
