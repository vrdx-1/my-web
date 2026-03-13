'use client';

import React from 'react';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { FeedSkeleton } from '@/components/FeedSkeleton';

export interface LikedFeedBlockProps {
  showSkeleton: boolean;
  skeletonCount: number;
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
  onImpression?: (postId: string) => void;
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
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  hideBoost?: boolean;
}

/** Feed หน้า liked — ไม่ใช้ PostFeed เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
export function LikedFeedBlock(props: LikedFeedBlockProps) {
  const {
    showSkeleton,
    skeletonCount,
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
    onImpression,
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
    loadingMore = false,
    hasMore = true,
    hideBoost = false,
  } = props;

  if (showSkeleton) {
    return (
      <FeedWithPreload showSkeleton={true} skeletonCount={skeletonCount}>
        <div style={{ display: 'contents' }} />
      </FeedWithPreload>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
        {loadingMore ? null : <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" />}
      </FeedWithPreload>
    );
  }

  const showNoMoreOnly = !hasMore && !loadingMore;
  const bottomSlotStyle: React.CSSProperties = {
    minHeight: showNoMoreOnly ? 120 : loadingMore ? 88 : 88,
    height: showNoMoreOnly ? 120 : loadingMore ? 88 : 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: showNoMoreOnly ? 'flex-start' : 'center',
    paddingTop: showNoMoreOnly ? 28 : 0,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    flexDirection: 'column',
    gap: 8,
  };

  const bottomSlot = (
    <div key="feed-bottom-slot" className="feed-bottom-slot" style={bottomSlotStyle}>
      {loadingMore ? <FeedSkeleton count={1} /> : null}
      <span
        style={{
          fontSize: '13px',
          color: '#111111',
          visibility: showNoMoreOnly ? 'visible' : 'hidden',
          display: showNoMoreOnly ? 'block' : 'none',
          width: '100%',
          textAlign: 'center',
        }}
      >
        ບໍ່ມີລາຍການເພີ່ມເຕີມ
      </span>
    </div>
  );

  return (
    <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
      <div style={{ display: 'contents' }}>
        {posts.map((post, index) => (
          <PostCard
            key={`${post.id}-${index}`}
            post={post}
            index={index}
            isLastElement={index === posts.length - 1}
            priority={index === 0}
            imageFetchPriority={index < 3 ? 'high' : 'low'}
            session={session}
            likedPosts={likedPosts}
            savedPosts={savedPosts}
            justLikedPosts={justLikedPosts}
            justSavedPosts={justSavedPosts}
            activeMenuState={activeMenuState}
            isMenuAnimating={isMenuAnimating}
            lastPostElementRef={index === posts.length - 1 ? lastPostElementRef : undefined}
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
        ))}
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
