import { useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
  rootMargin?: string;
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
}: UseInfiniteScrollProps) => {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loadingMore || !hasMore) return;
      
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingMore) {
            requestAnimationFrame(() => {
              onLoadMore();
            });
          }
        },
        { threshold, rootMargin }
      );
      
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, onLoadMore, threshold, rootMargin]
  );

  return { lastElementRef };
};
