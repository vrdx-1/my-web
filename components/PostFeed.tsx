'use client'

import React, { useRef, useEffect, useCallback } from 'react';
import { PostCard } from './PostCard';
import { EmptyState } from './EmptyState';
import { FeedSkeleton } from './FeedSkeleton';

interface PostFeedProps {
  posts: any[];
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  justLikedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onViewPost: (post: any, imageIndex: number) => void;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (post: any) => void;
  onViewLikes: (postId: string) => void;
  onViewSaves: (postId: string) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  onImpression?: (postId: string) => void;
  loadingMore?: boolean;
  emptyMessage?: string;
  hideBoost?: boolean;
  hasMore?: boolean;
  /** กดโหลดเพิ่มเมื่อ scroll ไม่ยิง (เช่น มือถือ/ container แยก) */
  onLoadMore?: () => void;
  /** อัปเดตเป็นระยะเพื่อให้สถานะออนไลน์ในการ์ด re-render (ไม่ต้อง refresh หน้า) */
  onlineStatusTick?: number;
  /** ฟีดหยุดเลื่อนแล้ว — ให้กดค้างแคปชั่นเพื่อเลือก/คัดลอกได้ (ไม่ส่ง = ถือว่า idle) */
  isFeedScrollIdle?: boolean;
}

/**
 * PostFeed Component
 * Reusable component for rendering a list of PostCard components
 */
export const PostFeed = React.memo<PostFeedProps>(({
  posts,
  session,
  likedPosts,
  savedPosts,
  justLikedPosts,
  justSavedPosts,
  activeMenuState,
  isMenuAnimating,
  lastPostElementRef,
  menuButtonRefs,
  onViewPost,
  onLike,
  onSave,
  onShare,
  onViewLikes,
  onViewSaves,
  onTogglePostStatus,
  onDeletePost,
  onReport,
  onSetActiveMenu,
  onSetMenuAnimating,
  onImpression,
  loadingMore = false,
  emptyMessage = 'ຍັງບໍ່ມີລາຍການ',
  hideBoost = false,
  hasMore = true,
  onLoadMore,
  onlineStatusTick,
  isFeedScrollIdle = true,
}) => {
  if (posts.length === 0) {
    return !loadingMore ? (
      <EmptyState message={emptyMessage} variant="default" />
    ) : null;
  }

  // Observer เดียวสำหรับ impression ทุกการ์ด — ลดจาก N observers เป็น 1 (ช่วยเมื่อ feed ยาว)
  const impressionSentRef = useRef<Set<string>>(new Set());
  const postIdToElementRef = useRef<Map<string, HTMLElement>>(new Map());
  const elementToPostIdRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());
  const impressionObserverRef = useRef<IntersectionObserver | null>(null);

  const registerImpressionRef = useCallback((el: HTMLElement | null, postId: string) => {
    if (!onImpression) return;
    if (el) {
      const existing = postIdToElementRef.current.get(postId);
      if (existing && existing !== el) {
        impressionObserverRef.current?.unobserve(existing);
        elementToPostIdRef.current.delete(existing);
        postIdToElementRef.current.delete(postId);
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
          { threshold: 0.25, rootMargin: '0px' }
        );
      }
      impressionObserverRef.current.observe(el);
      postIdToElementRef.current.set(postId, el);
      elementToPostIdRef.current.set(el, postId);
    } else {
      const prev = postIdToElementRef.current.get(postId);
      if (prev) {
        impressionObserverRef.current?.unobserve(prev);
        elementToPostIdRef.current.delete(prev);
        postIdToElementRef.current.delete(postId);
      }
    }
  }, [onImpression]);

  useEffect(() => {
    return () => {
      impressionObserverRef.current?.disconnect();
      impressionObserverRef.current = null;
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

  const cards = posts.map((post, index) => {
    const isLastElement = posts.length === index + 1;
    return React.createElement(PostCard, {
      key: `${post.id}-${index}`,
      post,
      index,
      isLastElement,
      priority: index === 0,
      session,
      likedPosts,
      savedPosts,
      justLikedPosts,
      justSavedPosts,
      activeMenuState,
      isMenuAnimating,
      lastPostElementRef: isLastElement ? lastPostElementRef : undefined,
      menuButtonRefs,
      onViewPost,
      onLike,
      onSave,
      onShare,
      onViewLikes,
      onViewSaves,
      onTogglePostStatus,
      onDeletePost,
      onReport,
      onSetActiveMenu,
      onSetMenuAnimating,
      onImpression,
      registerImpressionRef: onImpression ? registerImpressionRef : undefined,
      hideBoost,
      isFeedScrollIdle,
    });
  });

  return React.createElement(
    'div',
    { style: { display: 'contents' } },
    ...cards,
    bottomSlot
  );
});

PostFeed.displayName = 'PostFeed';
