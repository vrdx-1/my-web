'use client'
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load LikedPostsContent with real code splitting
const LazyLikedPosts = dynamic(() => import('./LikedPostsContent').then(mod => ({ default: mod.LikedPostsContent })), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>,
  ssr: true,
});

export default function LikedPosts() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <LazyLikedPosts />
    </Suspense>
  );
}
