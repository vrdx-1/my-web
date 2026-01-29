'use client'

import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load HomeContent with real code splitting
// This will create a separate bundle chunk that only loads when needed
const LazyHomeContent = dynamicNamed(() => import('./HomeContent'), 'HomeContent', { ssr: true });

export default function HomeClient() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazyHomeContent />
    </Suspense>
  );
}
