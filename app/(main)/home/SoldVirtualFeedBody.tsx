'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/components/PostCard';
import { HomePostImageGate } from '@/components/home/HomePostImageGate';
import { DEFAULT_EXCHANGE_RATES, normalizeExchangeRates, type ExchangeRates } from '@/utils/exchangeRates';

export interface SoldVirtualFeedBodyProps {
  posts: any[];
  session: any;
  savedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
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
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  showSkeleton: boolean;
  isRefreshing?: boolean;
  /** ไม่ได้ใช้แล้ว — คงไว้เพื่อ backward compat */
  pauseVirtualUpdates?: boolean;
}

export function SoldVirtualFeedBody({
  posts,
  session,
  savedPosts,
  justSavedPosts,
  activeMenuState,
  isMenuAnimating,
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
  loadingMore,
  hasMore,
  onLoadMore,
  showSkeleton,
  isRefreshing = false,
}: SoldVirtualFeedBodyProps) {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  // Fetch exchange rates once on mount — identical pattern to HomeFeedBody / PostCard
  useEffect(() => {
    let active = true;
    fetch('/api/exchange-rates/latest', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        const nextRates = (json as { rates?: ExchangeRates }).rates;
        if (!active) return;
        setExchangeRates(normalizeExchangeRates(nextRates));
      })
      .catch(() => {
        // keep defaults
      });
    return () => {
      active = false;
    };
  }, []);

  // IntersectionObserver sentinel — identical strategy to useInfiniteScroll used on recommend tab.
  // No scroll-position math, no getBoundingClientRect during render, no setViewport re-renders.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  // Skeleton transition — identical to HomeFeedBody (prevents flash)
  const [showingSkeleton, setShowingSkeleton] = useState(showSkeleton);
  useEffect(() => {
    if (showSkeleton) {
      setShowingSkeleton(true);
    } else {
      const t = setTimeout(() => setShowingSkeleton(false), 120);
      return () => clearTimeout(t);
    }
  }, [showSkeleton]);

  useEffect(() => {
    // Re-attach observer whenever content mode changes; the sentinel does not exist during skeleton render.
    if (showingSkeleton || posts.length === 0) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showingSkeleton, posts.length]);

  const effectivelyShowSkeleton =
    showingSkeleton || (posts.length === 0 && (loadingMore || isRefreshing));

  if (effectivelyShowSkeleton) {
    return (
      <FeedWithPreload showSkeleton={true} skeletonCount={3}>
        <div style={{ display: 'contents' }} />
      </FeedWithPreload>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={3}>
        <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" />
      </FeedWithPreload>
    );
  }

  const showNoMore = !hasMore && !loadingMore;

  return (
    <FeedWithPreload showSkeleton={false} skeletonCount={3}>
      <div style={{ display: 'contents' }}>
        {posts.map((post, index) => (
          // HomePostImageGate with enabled=false renders children directly — no preload gate,
          // no skeleton flash, identical to how recommend tab renders cards it has already seen.
          <HomePostImageGate key={`${post.id}-${index}`} post={post} enabled={false}>
            <PostCard
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
              hideBoost={true}
              exchangeRatesOverride={exchangeRates}
            />
          </HomePostImageGate>
        ))}

        {/* Sentinel triggers onLoadMore when scrolled into view — no scroll math needed */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        <div
          className="feed-bottom-slot"
          style={{
            minHeight: showNoMore ? 120 : loadingMore ? undefined : 88,
            height: showNoMore ? 120 : loadingMore ? undefined : 88,
            display: 'flex',
            alignItems: 'center',
            justifyContent: showNoMore ? 'flex-start' : 'center',
            paddingTop: showNoMore ? 28 : 0,
            width: '100%',
            boxSizing: 'border-box',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {loadingMore ? <FeedSkeleton count={1} /> : null}
          <span
            style={{
              fontSize: '13px',
              color: '#111111',
              display: showNoMore ? 'block' : 'none',
              width: '100%',
              textAlign: 'center',
            }}
          >
            ບໍ່ມີລາຍການເພີ່ມເຕີມ
          </span>
        </div>
      </div>
    </FeedWithPreload>
  );
}
