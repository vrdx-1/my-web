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
}) => {
  if (posts.length === 0) {
    return !loadingMore ? (
      <EmptyState message={emptyMessage} variant="default" />
    ) : null;
  }

  const bottomSlotStyle = {
    minHeight: 88,
    height: 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as const;

  // ให้ spinner อยู่ใน DOM ตลอด แค่ซ่อนด้วย visibility — ไม่ unmount จึงหมุนครบรอบได้
  const spinnerWrap = React.createElement(
    'span',
    {
      key: 'feed-spinner-wrap',
      style: { visibility: loadingMore ? 'visible' : 'hidden', display: 'inline-block' },
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
        visibility: !hasMore && !loadingMore ? 'visible' : 'hidden',
        display: !hasMore && !loadingMore ? 'inline' : 'none',
      },
    },
    'ບໍ່ມີລາຍການເພີ່ມເຕີມ'
  );

  const bottomSlot = React.createElement(
    'div',
    {
      key: 'feed-bottom-slot',
      className: 'feed-bottom-slot',
      style: bottomSlotStyle,
    },
    spinnerWrap,
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
