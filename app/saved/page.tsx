'use client'
import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load SavedPostsContent with real code splitting
const LazySavedPosts = dynamicNamed(() => import('./SavedPostsContent'), 'SavedPostsContent', { ssr: true });

export default function SavedPosts() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazySavedPosts />
    </Suspense>
  );
}
