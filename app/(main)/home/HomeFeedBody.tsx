'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import type { ComponentProps } from 'react';

/** Load PostFeed only on client to avoid React "Expected static flag was missing" (SSR/hydration). */
const PostFeed = dynamic(
  () => import('@/components/PostFeed').then((mod) => ({ default: mod.PostFeed })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

export type HomeFeedBodyProps = {
  showSkeleton: boolean;
  skeletonCount: number;
  postFeedProps: ComponentProps<typeof PostFeed>;
};

/** Render PostFeed only after client mount to avoid React "Expected static flag was missing". */
export function HomeFeedBody({ showSkeleton, skeletonCount, postFeedProps }: HomeFeedBodyProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (showSkeleton) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  if (!mounted) {
    return <FeedSkeleton count={skeletonCount} />;
  }
  return (
    <div style={{ animation: 'feed-content-fade-in 0.25s ease-out forwards' }}>
      <PostFeed {...postFeedProps} />
    </div>
  );
}
