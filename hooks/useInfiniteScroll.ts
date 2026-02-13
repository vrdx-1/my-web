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
          if (entries[0].isIntersecting && hasMore && !loadingMore) {
            // ใช้ requestAnimationFrame เพื่อให้ scroll smooth ก่อน trigger onLoadMore
            requestAnimationFrame(() => {
              onLoadMore();
            });
          }
        },
        { 
          threshold,
          rootMargin: '400px' // เพิ่ม rootMargin เพื่อ preload ล่วงหน้ามากขึ้น ให้เลื่อนได้ไวขึ้น (โหลดก่อนถึงโพสต์สุดท้าย 400px)
        }
      );
      
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, onLoadMore, threshold]
  );

  return { lastElementRef };
};
