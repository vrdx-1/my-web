'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { FeedWithPreload } from '@/components/FeedWithPreload';
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

/** Render PostFeed only after client mount. Preloading แบบ Facebook ผ่าน FeedWithPreload */
export function HomeFeedBody({ showSkeleton, skeletonCount, postFeedProps }: HomeFeedBodyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <FeedSkeleton count={skeletonCount} />;
  }

  return (
    <FeedWithPreload showSkeleton={showSkeleton} skeletonCount={skeletonCount}>
      <PostFeed {...postFeedProps} />
    </FeedWithPreload>
  );
}
