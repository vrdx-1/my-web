'use client'

import React from 'react';
import { PostCard } from './PostCard';
import { EmptyState } from './EmptyState';
import { PageSpinner } from './LoadingSpinner';

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
}) => {
  if (posts.length === 0) {
    return !loadingMore ? (
      <EmptyState message={emptyMessage} variant="default" />
    ) : null;
  }

  const showNoMoreOnly = !hasMore && !loadingMore;
  const bottomSlotStyle: React.CSSProperties = {
    minHeight: showNoMoreOnly ? 120 : 88,
    height: showNoMoreOnly ? 120 : 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: showNoMoreOnly ? 'flex-start' : 'center',
    paddingTop: showNoMoreOnly ? 28 : 0,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  // ให้ spinner อยู่ใน DOM ตลอด; ตอนไม่โหลดใช้ display none เพื่อไม่ให้ดันข้อความ "ບໍ່ມີລາຍການເພີ່ມເຕີມ" ลงไปจนไม่เห็น
  const spinnerWrap = React.createElement(
    'span',
    {
      key: 'feed-spinner-wrap',
      style: {
        visibility: loadingMore ? 'visible' : 'hidden',
        display: loadingMore ? 'inline-block' : 'none',
      },
    },
    React.createElement(PageSpinner)
  );
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

  const loadMoreButton = onLoadMore && hasMore && !loadingMore
    ? React.createElement(
        'button',
        {
          key: 'feed-load-more',
          type: 'button',
          onClick: onLoadMore,
          style: {
            fontSize: '14px',
            color: '#1877f2',
            background: 'none',
            border: '1px solid #1877f2',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
          },
        },
        'โหลดเพิ่ม'
      )
    : null;

  const bottomSlot = React.createElement(
    'div',
    {
      key: 'feed-bottom-slot',
      className: 'feed-bottom-slot',
      style: { ...bottomSlotStyle, flexDirection: 'column', gap: 8 },
    },
    spinnerWrap,
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
      hideBoost,
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
