import { useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
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
}: UseInfiniteScrollProps) => {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loadingMore || !hasMore) return;
      
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            onLoadMore();
          }
        },
        { threshold }
      );
      
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, onLoadMore, threshold]
  );

  return { lastElementRef };
};
