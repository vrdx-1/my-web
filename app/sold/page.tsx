'use client'

import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load SoldPageContent with real code splitting
const LazySoldPageContent = dynamicNamed(() => import('./SoldPageContent'), 'SoldPageContent', { ssr: true });

export default function SoldPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazySoldPageContent />
    </Suspense>
  );
}
