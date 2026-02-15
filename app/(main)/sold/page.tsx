'use client'

import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

const LazySoldPageContent = dynamicNamed(() => import('./SoldPageContent'), 'SoldPageContent', { ssr: true });

export default function SoldPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazySoldPageContent />
    </Suspense>
  );
}
