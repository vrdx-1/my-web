'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Observer เดียวสำหรับ impression ทุกการ์ด (เหมือน PostFeed)
 * หน้าโฮมแบบ virtual ถ้าไม่ใช้จะได้ IntersectionObserver ต่อการ์ด = N ตัว ตอนเลื่อนลึกแล้วเลื่อนกลับจะกิน main thread หนัก
 */
export function useFeedImpressionObserver(onImpression?: (postId: string) => void) {
  const impressionSentRef = useRef<Set<string>>(new Set());
  const postIdToElementRef = useRef<Map<string, HTMLElement>>(new Map());
  const elementToPostIdRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());
  const impressionObserverRef = useRef<IntersectionObserver | null>(null);

  const registerImpressionRef = useCallback(
    (el: HTMLElement | null, postId: string) => {
      if (!onImpression) return;
      const key = String(postId);
      if (el) {
        const existing = postIdToElementRef.current.get(key);
        if (existing && existing !== el) {
          impressionObserverRef.current?.unobserve(existing);
          elementToPostIdRef.current.delete(existing);
          postIdToElementRef.current.delete(key);
        }
        if (!impressionObserverRef.current) {
          impressionObserverRef.current = new IntersectionObserver(
            (entries) => {
              const sent = impressionSentRef.current;
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const postIdForEntry = elementToPostIdRef.current.get(entry.target as HTMLElement);
                if (!postIdForEntry || sent.has(postIdForEntry)) return;
                sent.add(postIdForEntry);
                impressionObserverRef.current?.unobserve(entry.target);
                const cb = () => onImpression(postIdForEntry);
                if (typeof requestIdleCallback !== 'undefined') {
                  (requestIdleCallback as typeof requestIdleCallback)(cb, { timeout: 500 });
                } else {
                  setTimeout(cb, 100);
                }
              });
            },
            { threshold: 0.25, rootMargin: '0px' },
          );
        }
        impressionObserverRef.current.observe(el);
        postIdToElementRef.current.set(key, el);
        elementToPostIdRef.current.set(el, key);
      } else {
        const prev = postIdToElementRef.current.get(key);
        if (prev) {
          impressionObserverRef.current?.unobserve(prev);
          elementToPostIdRef.current.delete(prev);
          postIdToElementRef.current.delete(key);
        }
      }
    },
    [onImpression],
  );

  useEffect(() => {
    return () => {
      impressionObserverRef.current?.disconnect();
      impressionObserverRef.current = null;
    };
  }, []);

  return onImpression ? registerImpressionRef : undefined;
}
