'use client'

import React from 'react';
import { PostCard } from './PostCard';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

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

  return (
    <>
      {posts.map((post, index) => {
        const isLastElement = posts.length === index + 1;
        return (
          <PostCard
            key={`${post.id}-${index}`}
            post={post}
            index={index}
            isLastElement={isLastElement}
            session={session}
            likedPosts={likedPosts}
            savedPosts={savedPosts}
            justLikedPosts={justLikedPosts}
            justSavedPosts={justSavedPosts}
            activeMenuState={activeMenuState}
            isMenuAnimating={isMenuAnimating}
            lastPostElementRef={isLastElement ? lastPostElementRef : undefined}
            menuButtonRefs={menuButtonRefs}
            onViewPost={onViewPost}
            onLike={onLike}
            onSave={onSave}
            onShare={onShare}
            onViewLikes={onViewLikes}
            onViewSaves={onViewSaves}
            onTogglePostStatus={onTogglePostStatus}
            onDeletePost={onDeletePost}
            onReport={onReport}
            onSetActiveMenu={onSetActiveMenu}
            onSetMenuAnimating={onSetMenuAnimating}
            onImpression={onImpression}
            hideBoost={hideBoost}
          />
        );
      })}

      {/* จองพื้นที่คงที่ ไม่ให้ layout shift ตอนโหลดโพสต์ถัดไป (ลดการกระตุก/กระพริบ) */}
      <div style={{ minHeight: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {loadingMore ? (
          <LoadingSpinner />
        ) : !hasMore ? (
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            ບໍ່ມີລາຍການເພີ່ມເຕີມ
          </span>
        ) : null}
      </div>
    </>
  );
});

PostFeed.displayName = 'PostFeed';
