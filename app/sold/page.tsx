'use client'

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load SoldPageContent with real code splitting
const LazySoldPageContent = dynamic(() => import('./SoldPageContent').then(mod => ({ default: mod.SoldPageContent })), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>,
  ssr: true,
});

export default function SoldPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <LazySoldPageContent />
    </Suspense>
  );
}
