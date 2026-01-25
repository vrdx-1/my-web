'use client'
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load SavedPostsContent with real code splitting
const LazySavedPosts = dynamic(() => import('./SavedPostsContent').then(mod => ({ default: mod.SavedPostsContent })), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>,
  ssr: true,
});

export default function SavedPosts() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <LazySavedPosts />
    </Suspense>
  );
}
