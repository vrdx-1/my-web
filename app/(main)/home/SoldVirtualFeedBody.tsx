'use client';

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/components/PostCard';
import { preloadPostVisibleImages } from '@/utils/imagePreload';
import { DEFAULT_EXCHANGE_RATES, normalizeExchangeRates, type ExchangeRates } from '@/utils/exchangeRates';

const SOLD_ESTIMATED_CARD_HEIGHT = 560;
const SOLD_OVERSCAN = 5;
const SOLD_PRELOAD_CONCURRENCY = 2;

type QueueTask = {
  run: () => Promise<void>;
  resolve: () => void;
};

const preloadQueue: QueueTask[] = [];
let activePreloads = 0;

function flushPreloadQueue() {
  if (activePreloads >= SOLD_PRELOAD_CONCURRENCY) return;
  const next = preloadQueue.shift();
  if (!next) return;

  activePreloads += 1;
  next
    .run()
    .catch(() => {
      // ignore preload failures
    })
    .finally(() => {
      activePreloads -= 1;
      next.resolve();
      flushPreloadQueue();
    });
}

function enqueuePreload(task: () => Promise<void>) {
  return new Promise<void>((resolve) => {
    preloadQueue.push({ run: task, resolve });
    flushPreloadQueue();
  });
}

function soldPreloadKey(post: any): string {
  const imageCount = Array.isArray(post?.images) ? post.images.length : 0;
  return `${String(post?.id ?? '')}:${String(post?.layout ?? '')}:${imageCount}`;
}

const SOLD_PRELOAD_DONE_KEYS = new Set<string>();
const SOLD_PRELOAD_CACHE_LIMIT = 1200;

function rememberSoldPreloadDone(key: string) {
  if (SOLD_PRELOAD_DONE_KEYS.has(key)) return;
  if (SOLD_PRELOAD_DONE_KEYS.size >= SOLD_PRELOAD_CACHE_LIMIT) {
    const first = SOLD_PRELOAD_DONE_KEYS.values().next().value as string | undefined;
    if (first) SOLD_PRELOAD_DONE_KEYS.delete(first);
  }
  SOLD_PRELOAD_DONE_KEYS.add(key);
}

function SoldImageGate({ post, enabled, children }: { post: any; enabled: boolean; children: React.ReactNode }) {
  const stableKey = soldPreloadKey(post);
  const [ready, setReady] = useState(() => !enabled || SOLD_PRELOAD_DONE_KEYS.has(stableKey));

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }

    if (SOLD_PRELOAD_DONE_KEYS.has(stableKey)) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    enqueuePreload(() => preloadPostVisibleImages(post)).then(() => {
      if (cancelled) return;
      rememberSoldPreloadDone(stableKey);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, stableKey, post]);
  if (enabled && !ready) return <FeedSkeleton count={1} />;
  return <>{children}</>;
}

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
}

function findStartIndex(offsets: number[], scrollTop: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = offsets[mid];
    if (value <= scrollTop) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, low - 1);
}

export function SoldVirtualFeedBody(props: SoldVirtualFeedBodyProps) {
  const {
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
  } = props;

  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? { top: 0, height: 900 } : { top: window.scrollY, height: window.innerHeight },
  );
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [measuredHeights, setMeasuredHeights] = useState<Record<number, number>>({});

  const resizeObserversRef = useRef<Map<number, ResizeObserver>>(new Map());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setViewport({ top: window.scrollY, height: window.innerHeight });
      });
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    const docHeight = document.documentElement.scrollHeight;
    const threshold = viewport.top + viewport.height + 700;
    if (threshold >= docHeight && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [viewport, hasMore, loadingMore, onLoadMore, posts.length]);

  const offsets = useMemo(() => {
    const arr = new Array(posts.length + 1).fill(0);
    for (let i = 0; i < posts.length; i += 1) {
      const h = measuredHeights[i] ?? SOLD_ESTIMATED_CARD_HEIGHT;
      arr[i + 1] = arr[i] + h;
    }
    return arr;
  }, [posts.length, measuredHeights]);

  const totalHeight = offsets[offsets.length - 1] ?? 0;
  const start = Math.max(0, findStartIndex(offsets, viewport.top) - SOLD_OVERSCAN);
  const end = Math.min(
    posts.length - 1,
    findStartIndex(offsets, viewport.top + viewport.height) + SOLD_OVERSCAN,
  );

  const topSpacer = offsets[start] ?? 0;
  const bottomSpacer = Math.max(0, totalHeight - (offsets[end + 1] ?? totalHeight));

  const setMeasuredRef = useCallback((index: number, node: HTMLDivElement | null) => {
    const existing = resizeObserversRef.current.get(index);
    if (existing) {
      existing.disconnect();
      resizeObserversRef.current.delete(index);
    }
    if (!node) return;

    const read = () => {
      const next = Math.ceil(node.getBoundingClientRect().height);
      if (!Number.isFinite(next) || next <= 0) return;

      setMeasuredHeights((prev) => {
        if (prev[index] === next) return prev;
        return { ...prev, [index]: next };
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    resizeObserversRef.current.set(index, observer);
  }, []);

  useEffect(() => {
    return () => {
      resizeObserversRef.current.forEach((observer) => observer.disconnect());
      resizeObserversRef.current.clear();
    };
  }, []);

  if (showSkeleton) {
    return <FeedSkeleton count={3} />;
  }

  if (posts.length === 0) {
    if (loadingMore || isRefreshing) return <FeedSkeleton count={3} />;
    return <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" />;
  }

  const visiblePosts = start <= end ? posts.slice(start, end + 1) : [];

  return (
    <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
      {topSpacer > 0 ? <div style={{ height: `${topSpacer}px` }} /> : null}
      {visiblePosts.map((post, localIndex) => {
        const index = start + localIndex;
        const isLastElement = index === posts.length - 1;
        const enableImageGate = localIndex <= SOLD_OVERSCAN + 1;

        return (
          <div
            key={`${post.id}-${index}`}
            ref={(node) => {
              setMeasuredRef(index, node);
            }}
          >
            <SoldImageGate post={post} enabled={enableImageGate}>
              <PostCard
                post={post}
                index={index}
                isLastElement={isLastElement}
                priority={localIndex === 0}
                imageFetchPriority={localIndex < 3 ? 'high' : 'low'}
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
            </SoldImageGate>
          </div>
        );
      })}
      {bottomSpacer > 0 ? <div style={{ height: `${bottomSpacer}px` }} /> : null}

      <div
        className="feed-bottom-slot"
        style={{
          minHeight: !hasMore && !loadingMore ? 120 : loadingMore ? undefined : 88,
          height: !hasMore && !loadingMore ? 120 : loadingMore ? undefined : 88,
          display: 'flex',
          alignItems: 'center',
          justifyContent: !hasMore && !loadingMore ? 'flex-start' : 'center',
          paddingTop: !hasMore && !loadingMore ? 28 : 0,
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
            visibility: !hasMore && !loadingMore ? 'visible' : 'hidden',
            display: !hasMore && !loadingMore ? 'block' : 'none',
            width: '100%',
            textAlign: 'center',
          }}
        >
          ບໍ່ມີລາຍການເພີ່ມເຕີມ
        </span>
      </div>
    </div>
  );
}
