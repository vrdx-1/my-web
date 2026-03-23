'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { PostCard } from './PostCard';
import { EmptyState } from './EmptyState';
import { FeedSkeleton } from './FeedSkeleton';

interface PostFeedProps {
  posts: any[];
  session: any;
  savedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onViewPost: (post: any, imageIndex: number) => void;
  onSave: (postId: string) => void;
  onShare: (post: any) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  loadingMore?: boolean;
  emptyMessage?: string;
  hideBoost?: boolean;
  hasMore?: boolean;
  /** กดโหลดเพิ่มเมื่อ scroll ไม่ยิง (เช่น มือถือ/ container แยก) */
  onLoadMore?: () => void;
  /** อัปเดตเป็นระยะเพื่อให้สถานะออนไลน์ในการ์ด re-render (ไม่ต้อง refresh หน้า) */
  onlineStatusTick?: number;
}

/**
 * PostFeed Component
 * Reusable component for rendering a list of PostCard components.
 * ไม่ใช้ React.memo เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" ในหน้า saved/liked/my-posts
 */
export function PostFeed({
  posts,
  session,
  savedPosts,
  justSavedPosts,
  activeMenuState,
  isMenuAnimating,
  lastPostElementRef,
  menuButtonRefs,
  onViewPost,
  onSave,
  onShare,
  onTogglePostStatus,
  onDeletePost,
  onReport,
  onSetActiveMenu,
  onSetMenuAnimating,
  loadingMore = false,
  emptyMessage = 'ຍັງບໍ່ມີລາຍການ',
  hideBoost = false,
  hasMore = true,
  onLoadMore,
  onlineStatusTick,
}: PostFeedProps) {
  if (posts.length === 0) {
    return !loadingMore ? (
      <EmptyState message={emptyMessage} variant="default" />
    ) : null;
  }

  // โพสต์ที่อยู่ใน viewport ได้ priority โหลดรูปก่อน (แก้โพสต์ในจอโหลดไม่ทัน โพสต์นอกจอโหลดก่อน)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(() => new Set([0, 1, 2]));
  const visibleIndicesRef = useRef<Set<number>>(new Set([0, 1, 2]));
  const elementToIndexRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap());
  const indexToElementRef = useRef<Map<number, HTMLElement>>(new Map());
  const visibilityObserverRef = useRef<IntersectionObserver | null>(null);

  const registerVisibilityRef = useCallback((el: HTMLElement | null, index: number) => {
    if (el) {
      const prev = indexToElementRef.current.get(index);
      if (prev && prev !== el) {
        visibilityObserverRef.current?.unobserve(prev);
        elementToIndexRef.current.delete(prev);
        indexToElementRef.current.delete(index);
      }
      if (!visibilityObserverRef.current) {
        visibilityObserverRef.current = new IntersectionObserver(
          (entries) => {
            const set = visibleIndicesRef.current;
            entries.forEach((entry) => {
              const idx = elementToIndexRef.current.get(entry.target as HTMLElement);
              if (idx === undefined) return;
              if (entry.isIntersecting) set.add(idx);
              else set.delete(idx);
            });
            setVisibleIndices(new Set(set));
          },
          { threshold: 0.1, rootMargin: '100px 0px' }
        );
      }
      elementToIndexRef.current.set(el, index);
      indexToElementRef.current.set(index, el);
      visibilityObserverRef.current.observe(el);
    } else {
      const prevEl = indexToElementRef.current.get(index);
      if (prevEl) {
        visibilityObserverRef.current?.unobserve(prevEl);
        elementToIndexRef.current.delete(prevEl);
        indexToElementRef.current.delete(index);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      visibilityObserverRef.current?.disconnect();
      visibilityObserverRef.current = null;
    };
  }, []);

  const showNoMoreOnly = !hasMore && !loadingMore;
  // โหลดเพิ่ม: ให้ bottom slot ขยายตาม Skeleton (ไม่บีบความสูงเป็น 0) เพื่อไม่ให้ผู้ใช้เลื่อนลงไปเกิน Skeleton ได้
  const bottomSlotStyle: React.CSSProperties = {
    minHeight: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
    height: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: showNoMoreOnly ? 'flex-start' : 'center',
    paddingTop: showNoMoreOnly ? 28 : 0,
    flexShrink: loadingMore ? 0 : 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  // โหลดเพิ่ม = แสดง Skeleton ที่ท้าย feed (ไม่ใช้ spinner)
  const loadingMoreSkeleton = loadingMore ? React.createElement(FeedSkeleton, { key: 'feed-loading-skeleton', count: 1 }) : null;
  const noMoreText = React.createElement(
    'span',
    {
      key: 'feed-no-more',
      style: {
        fontSize: '13px',
        color: '#111111',
        visibility: showNoMoreOnly ? 'visible' : 'hidden',
        display: showNoMoreOnly ? 'block' : 'none',
        width: '100%',
        textAlign: 'center',
      },
    },
    'ບໍ່ມີລາຍການເພີ່ມເຕີມ'
  );

  const loadMoreButton = null;

  const bottomSlot = React.createElement(
    'div',
    {
      key: 'feed-bottom-slot',
      className: 'feed-bottom-slot',
      style: { ...bottomSlotStyle, flexDirection: 'column', gap: 8 },
    },
    loadingMoreSkeleton,
    loadMoreButton,
    noMoreText
  );

  const validVisible = [...visibleIndices].filter((i) => i < posts.length);
  const firstVisibleIndex = validVisible.length > 0 ? Math.min(...validVisible) : 0;
  const cards = posts.map((post, index) => {
    const isLastElement = posts.length === index + 1;
    const inViewport = visibleIndices.has(index);
    return React.createElement(PostCard, {
      key: `${post.id}-${index}`,
      post,
      index,
      isLastElement,
      priority: index === firstVisibleIndex,
      imageFetchPriority: inViewport ? 'high' : 'low',
      session,
      savedPosts,
      justSavedPosts,
      activeMenuState,
      isMenuAnimating,
      lastPostElementRef: isLastElement ? lastPostElementRef : undefined,
      menuButtonRefs,
      onViewPost,
      onSave,
      onShare,
      onTogglePostStatus,
      onDeletePost,
      onReport,
      onSetActiveMenu,
      onSetMenuAnimating,
      registerVisibilityRef,
      hideBoost,
    });
  });

  return React.createElement(
    'div',
    { style: { display: 'contents' } },
    ...cards,
    bottomSlot
  );
}
