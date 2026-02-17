'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ລາຍການທີ່ບັນທຶກ" />;

const LazySavedPosts = dynamicNamed(() => import('./SavedPostsContent'), 'SavedPostsContent', {
  ssr: true,
  loading: () => feedFallback,
});

export default function SavedPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazySavedPosts />
    </Suspense>
  );
}
