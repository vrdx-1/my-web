'use client'

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load HomeContent with real code splitting
// This will create a separate bundle chunk that only loads when needed
const LazyHomeContent = dynamic(() => import('./HomeContent').then(mod => ({ default: mod.HomeContent })), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>,
  ssr: true,
});

export default function Home() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <LazyHomeContent />
    </Suspense>
  );
}
