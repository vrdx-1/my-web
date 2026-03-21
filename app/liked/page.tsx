'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

/** ต้องตรงกับ LikedPostsContent (home-tab-navigation + ไม่มีเส้นใต้ header) ไม่เช่นนั้นแท็บจะกระโดดตอน refresh */
const feedFallback = (
  <FeedPageSkeletonFallback
    title="ລາຍການທີ່ມັກ"
    tabNavigationClassName="home-tab-navigation"
    showHeaderDivider={false}
    feedSkeletonCount={3}
  />
);

/** ปิด SSR เพื่อหลีกเลี่ยง React "Expected static flag was missing" ตอน hydrate กับ PostFeed */
const LazyLikedPosts = dynamicNamed(() => import('./LikedPostsContent'), 'LikedPostsContent', {
  ssr: false,
  loading: () => feedFallback,
});

export default function LikedPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyLikedPosts />
    </Suspense>
  );
}
