'use client';

import React from 'react';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { FeedSkeleton } from '@/components/FeedSkeleton';

export interface MyPostsFeedBlockProps {
  showSkeleton: boolean;
  skeletonCount: number;
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
  onRepost?: (postId: string) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  hideBoost?: boolean;
}

/** Feed หน้า my-posts — ไม่ใช้ PostFeed เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
export function MyPostsFeedBlock(props: MyPostsFeedBlockProps) {
  const {
    showSkeleton,
    skeletonCount,
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
    onRepost,
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
    minHeight: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
    height: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
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
            savedPosts={savedPosts}
            justSavedPosts={justSavedPosts}
            activeMenuState={activeMenuState}
            isMenuAnimating={isMenuAnimating}
            lastPostElementRef={index === posts.length - 1 ? lastPostElementRef : undefined}
            menuButtonRefs={menuButtonRefs}
            onViewPost={onViewPost}
            onSave={onSave}
            onShare={onShare}
            onTogglePostStatus={onTogglePostStatus}
            onDeletePost={onDeletePost}
            onReport={onReport}
            onRepost={onRepost}
            onSetActiveMenu={onSetActiveMenu}
            onSetMenuAnimating={onSetMenuAnimating}
            hideBoost={hideBoost}
          />
        ))}
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
