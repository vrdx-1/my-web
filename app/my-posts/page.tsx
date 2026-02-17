'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ໂພສຂອງຂ້ອຍ" />;

const LazyMyPosts = dynamicNamed(() => import('./MyPostsContent'), 'MyPostsContent', {
  ssr: true,
  loading: () => feedFallback,
});

export default function MyPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyMyPosts />
    </Suspense>
  );
}
