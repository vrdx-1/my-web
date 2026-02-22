'use client';

import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** Fallback แค่ Skeleton — Header + แท็บ ພ້ອມຂາຍ/ຂາຍແລ້ວ มาจาก layout อยู่แล้ว */
const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <FeedSkeleton />
  </main>
);

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
