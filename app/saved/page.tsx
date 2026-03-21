'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

/** ตรงกับ SavedPostsContent (home-tab-navigation + ไม่มีเส้นใต้ header + FeedSkeleton 3 การ์ด เหมือนหน้า liked) */
const feedFallback = (
  <FeedPageSkeletonFallback
    title="ລາຍການທີ່ບັນທຶກ"
    tabNavigationClassName="home-tab-navigation"
    showHeaderDivider={false}
    feedSkeletonCount={3}
  />
);

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
