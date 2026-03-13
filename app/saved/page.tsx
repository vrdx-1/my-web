'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ລາຍການທີ່ບັນທຶກ" />;

/** ปิด SSR เพื่อหลีกเลี่ยง React "Expected static flag was missing" ตอน hydrate กับ PostFeed */
const LazySavedPosts = dynamicNamed(() => import('./SavedPostsContent'), 'SavedPostsContent', {
  ssr: false,
  loading: () => feedFallback,
});

export default function SavedPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazySavedPosts />
    </Suspense>
  );
}
