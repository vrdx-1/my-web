'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ໂພສຂອງຂ້ອຍ" />;

/** ปิด SSR เพื่อหลีกเลี่ยง React "Expected static flag was missing" ตอน hydrate กับ PostFeed */
const LazyMyPosts = dynamicNamed(() => import('./MyPostsContent'), 'MyPostsContent', {
  ssr: false,
  loading: () => feedFallback,
});

export default function MyPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyMyPosts />
    </Suspense>
  );
}
