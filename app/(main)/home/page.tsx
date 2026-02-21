'use client';

import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedPageSkeletonFallback } from '@/components/FeedPageSkeletonFallback';

const feedFallback = <FeedPageSkeletonFallback title="ໜ້າຫຼັກ" />;

const LazyHomePageContent = dynamicNamed(() => import('./HomePageContent'), 'HomePageContent', {
  ssr: true,
  loading: () => feedFallback,
});

export default function HomePage() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyHomePageContent />
    </Suspense>
  );
}
