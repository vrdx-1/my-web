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
  /**
   * จำนวนโพสในลิสต์ปัจจุบัน (เช่น posts.length)
   * ใช้เมื่อโหลดเพิ่มแบบ client-side โดยไม่มี loadingMore สลับ true/false (เช่น ผลค้นหาโฮม)
   * เพื่อรีเซ็ต sentinel หลังโหลดเพิ่ม — ไม่ส่งก็ยังใช้ร่วมกับ loadingMore แบบเดิมได้
   */
  feedPostCount?: number;
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
  feedPostCount,
}: UseInfiniteScrollProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  /** ป้องกันยิง onLoadMore ซ้ำก่อน loadingMore อัปเดต — เลื่อน feed แล้ว refresh/โหลดซ้ำผิดจังหวะ */
  const triggeredRef = useRef(false);

  const lastElementRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    if (!node) return;
    /** sentinel เปลี่ยน (โพสใหม่ท้ายลิสต์) — ต้องยิงโหลดเพิ่มได้อีก แม้ loadingMore ไม่สลับ (เช่น slice ผลค้นหา) */
    triggeredRef.current = false;
    const root = rootRef?.current ?? undefined;
    observer.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        observer.current?.unobserve(entries[0].target);
        requestAnimationFrame(() => {
          onLoadMoreRef.current();
        });
      },
      { threshold, rootMargin, root }
    );
    observer.current.observe(node);
  }, [threshold, rootMargin, rootRef]);

  useEffect(() => {
    if (loadingMore || !hasMore) return;
    triggeredRef.current = false;
    const node = nodeRef.current;
    if (!node) return;
    const root = rootRef?.current ?? undefined;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        observer.current?.unobserve(entries[0].target);
        requestAnimationFrame(() => {
          onLoadMoreRef.current();
        });
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
  }, [loadingMore, hasMore, threshold, rootMargin, rootRef, feedPostCount]);

  return { lastElementRef };
};
