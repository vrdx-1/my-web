'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { HomePostImageGate } from '@/components/home/HomePostImageGate';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { markHomeFeedSeenPostIds, resolveHomeFeedActorKey } from '@/hooks/homeFeedStorage';

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
  /** เปิดเฉพาะแท็บแนะนำปกติ (ไม่ใช่ผลค้นหา) เพื่อ track impression จาก viewport จริง */
  enableViewportTracking?: boolean;
  /** scope จังหวัดของฟีดปัจจุบัน (ว่าง = all) */
  trackingProvince?: string;
  trackingActiveProfileId?: string | null;
  trackingAuthUserId?: string | null;
  postFeedProps: {
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
  };
  onLocalPostUpdate?: (postId: string, data: Record<string, unknown>) => void;
};

/** หน้าโฮม — ไม่ใช้ PostFeed เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
export function HomeFeedBody({ showSkeleton, forceSkeletonWhenEmpty = false, mayShowEmptyState = true, isSearchLoading = false, skeletonCount, gateImageReady = false, onPrefetchNextPost, enableViewportTracking = false, trackingProvince, trackingActiveProfileId, trackingAuthUserId, postFeedProps, onLocalPostUpdate }: HomeFeedBodyProps) {
  const {
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
  } = postFeedProps;

  // Keep the first SSR/CSR render identical to avoid hydration drift from client-only feed state.
  const [hasHydrated, setHasHydrated] = React.useState(false);
  React.useEffect(() => {
    setHasHydrated(true);
  }, []);

  // เพิ่ม state สำหรับ skeleton transition (กันจอขาวระหว่างเปลี่ยน tab หรือโหลดใหม่)
  const [showingSkeleton, setShowingSkeleton] = React.useState(showSkeleton);
  React.useEffect(() => {
    if (showSkeleton) setShowingSkeleton(true);
    else {
      // delay hide skeleton เล็กน้อยเพื่อกันกระพริบ
      const t = setTimeout(() => setShowingSkeleton(false), 120);
      return () => clearTimeout(t);
    }
  }, [showSkeleton]);

  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const elementToPostIdRef = React.useRef<WeakMap<Element, string>>(new WeakMap());
  const postToElementRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const trackedPostIdsRef = React.useRef<Set<string>>(new Set());
  const pendingPostIdsRef = React.useRef<Set<string>>(new Set());
  const flushTimerRef = React.useRef<number | null>(null);

  const flushImpressions = React.useCallback(async () => {
    if (!enableViewportTracking) return;
    const postIds = Array.from(pendingPostIdsRef.current);
    if (postIds.length === 0) return;
    pendingPostIdsRef.current.clear();

    let guestToken: string | null = null;
    if (!session?.user?.id) {
      try {
        guestToken = getPrimaryGuestToken();
      } catch {
        guestToken = null;
      }
    }

    const actorKey = resolveHomeFeedActorKey(
      trackingActiveProfileId || (typeof session?.user?.id === 'string' ? session.user.id : trackingAuthUserId) || null,
      guestToken,
    );
    if (actorKey) {
      markHomeFeedSeenPostIds(trackingProvince, actorKey, postIds);
    }

    try {
      const response = await fetch('/api/posts/feed/impressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postIds,
          status: 'recommend',
          province: trackingProvince,
          activeProfileId: trackingActiveProfileId || undefined,
          authUserId: trackingAuthUserId || undefined,
          guestToken,
        }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        console.warn('[feed viewport tracking] request failed', {
          status: response.status,
          error: errorPayload,
        });
      }
    } catch {
      // Ignore fire-and-forget tracking failures.
    }
  }, [enableViewportTracking, session?.user?.id, trackingProvince, trackingActiveProfileId, trackingAuthUserId]);

  const scheduleFlush = React.useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      void flushImpressions();
    }, 250);
  }, [flushImpressions]);

  const ensureObserver = React.useCallback(() => {
    if (!enableViewportTracking) return null;
    if (observerRef.current) return observerRef.current;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.25) return;
          const postId = elementToPostIdRef.current.get(entry.target);
          if (!postId) return;
          if (trackedPostIdsRef.current.has(postId)) return;
          trackedPostIdsRef.current.add(postId);
          pendingPostIdsRef.current.add(postId);
          scheduleFlush();
        });
      },
      {
        threshold: [0.25, 0.5],
        rootMargin: '0px 0px -10% 0px',
      },
    );
    return observerRef.current;
  }, [enableViewportTracking, scheduleFlush]);

  const registerImpressionRef = React.useCallback((postId: string, node: HTMLElement | null) => {
    const prev = postToElementRef.current.get(postId);
    if (prev && prev !== node) {
      observerRef.current?.unobserve(prev);
      elementToPostIdRef.current.delete(prev);
      postToElementRef.current.delete(postId);
    }

    if (!node) {
      if (prev) {
        observerRef.current?.unobserve(prev);
        elementToPostIdRef.current.delete(prev);
      }
      postToElementRef.current.delete(postId);
      return;
    }

    postToElementRef.current.set(postId, node);
    elementToPostIdRef.current.set(node, postId);
    const observer = ensureObserver();
    observer?.observe(node);
  }, [ensureObserver]);

  React.useEffect(() => {
    if (!enableViewportTracking) return;
    // Allow retracking if list content has changed substantially (e.g. refresh/new seed).
    const currentIds = new Set(posts.map((post) => String(post.id)));
    trackedPostIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) trackedPostIdsRef.current.delete(id);
    });
  }, [enableViewportTracking, posts]);

  React.useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      postToElementRef.current.clear();
      pendingPostIdsRef.current.clear();
    };
  }, []);

  // เงื่อนไข skeleton ที่ครอบคลุม: loading, empty, กำลังเปลี่ยน tab, หรือ transition
  const effectivelyShowSkeleton =
    !hasHydrated ||
    showingSkeleton ||
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
        {posts.map((post, index) => {
          const isLastInFeed = index === posts.length - 1;
          const shouldGateImages = gateImageReady && index >= 2;
          return (
            <div key={`${post.id}-${index}`} ref={(node) => registerImpressionRef(String(post.id), node)}>
              <HomePostImageGate
                post={post}
                enabled={shouldGateImages}
                onImagesReady={gateImageReady && isLastInFeed ? onPrefetchNextPost : undefined}
              >
                <PostCard
                  post={post}
                  index={index}
                  isLastElement={isLastInFeed}
                  priority={index === 0}
                  imageFetchPriority={index < 3 ? 'high' : 'low'}
                  session={session}
                  savedPosts={savedPosts}
                  justSavedPosts={justSavedPosts}
                  activeMenuState={activeMenuState}
                  isMenuAnimating={isMenuAnimating}
                  lastPostElementRef={isLastInFeed ? lastPostElementRef : undefined}
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
                  onLocalUpdate={onLocalPostUpdate}
                />
              </HomePostImageGate>
            </div>
          );
        })}
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
