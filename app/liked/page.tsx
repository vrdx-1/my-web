'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ລາຍການທີ່ມັກ" />;

const LazyLikedPosts = dynamicNamed(() => import('./LikedPostsContent'), 'LikedPostsContent', {
  ssr: true,
  loading: () => feedFallback,
});

export default function LikedPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyLikedPosts />
    </Suspense>
  );
}
