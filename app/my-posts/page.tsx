'use client'
import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load MyPostsContent with real code splitting
const LazyMyPosts = dynamicNamed(() => import('./MyPostsContent'), 'MyPostsContent', { ssr: true });

export default function MyPosts() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazyMyPosts />
    </Suspense>
  );
}
