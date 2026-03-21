'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { HomePostImageGate } from '@/components/home/HomePostImageGate';

export type HomeFeedBodyProps = {
  showSkeleton: boolean;
  /** เมื่อ true และ posts ว่าง → แสดง skeleton แทน "ຍັງບໍ່ມີລາຍການ" (ใช้ตอนกำลังค้นหา) */
  forceSkeletonWhenEmpty?: boolean;
  /** แสดง "ຍັງບໍ່ມີລາຍການ" ได้เฉพาะเมื่อ true (parent ส่ง false ตอนกำลังค้นหา) */
  mayShowEmptyState?: boolean;
  /** true = กำลังโหลดผลค้นหา → ถ้า posts ว่างให้แสดง skeleton เท่านั้น */
  isSearchLoading?: boolean;
  skeletonCount: number;
  /** แท็บแนะนำ: รอโหลดรูปที่เห็นใน layout ก่อนแสดงการ์ด */
  gateImageReady?: boolean;
  /** เรียกเมื่อโพสสุดท้ายในลิสต์โหลดรูปครบ — โหลดโพสถัดไปล่วงหน้า (เมื่อมีโพสในคิวไม่เกิน 2) */
  onPrefetchNextPost?: () => void;
  postFeedProps: {
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
  };
};

/** หน้าโฮม — ไม่ใช้ PostFeed เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
export function HomeFeedBody({ showSkeleton, forceSkeletonWhenEmpty = false, mayShowEmptyState = true, isSearchLoading = false, skeletonCount, gateImageReady = false, onPrefetchNextPost, postFeedProps }: HomeFeedBodyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <FeedSkeleton count={skeletonCount} />;
  }

  const {
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
  } = postFeedProps;

  const effectivelyShowSkeleton =
    showSkeleton ||
    (forceSkeletonWhenEmpty && posts.length === 0) ||
    (isSearchLoading && posts.length === 0);
  if (effectivelyShowSkeleton) {
    return (
      <FeedWithPreload showSkeleton={true} skeletonCount={skeletonCount}>
        <div style={{ display: 'contents' }} />
      </FeedWithPreload>
    );
  }

  if (posts.length === 0) {
    const showEmpty = mayShowEmptyState && !isSearchLoading && !loadingMore;
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
        {showEmpty ? <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" /> : <FeedSkeleton count={skeletonCount} />}
      </FeedWithPreload>
    );
  }

  const showNoMoreOnly = !hasMore && !loadingMore;
  /**
   * ตอน loadingMore เคยบีบความสูง 88px ทำให้ FeedSkeleton การ์ดเต็มดูคนละแบบกับ HomePostImageGate (การ์ดเต็ม)
   * ใช้ container ไม่จำกัดความสูง — รูปแบบเดียวกับ FeedSkeleton count={1} ที่อื่น
   */
  const bottomSlotStyle: React.CSSProperties = loadingMore
    ? {
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
      }
    : {
        minHeight: showNoMoreOnly ? 120 : 88,
        height: showNoMoreOnly ? 120 : 88,
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
          <HomePostImageGate
            key={`${post.id}-${index}`}
            post={post}
            enabled={gateImageReady}
            onImagesReady={
              gateImageReady && index === posts.length - 1
                ? onPrefetchNextPost
                : undefined
            }
          >
            <PostCard
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
          </HomePostImageGate>
        ))}
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
