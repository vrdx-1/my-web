'use client'
import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load LikedPostsContent with real code splitting
const LazyLikedPosts = dynamicNamed(() => import('./LikedPostsContent'), 'LikedPostsContent', { ssr: true });

export default function LikedPosts() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazyLikedPosts />
    </Suspense>
  );
}
