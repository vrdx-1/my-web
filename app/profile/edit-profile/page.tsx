'use client'
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load EditProfileContent with real code splitting
const LazyEditProfile = dynamic(() => import('./EditProfileContent').then(mod => ({ default: mod.EditProfileContent })), {
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>,
  ssr: true,
});

export default function EditProfile() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingSpinner /></div>}>
      <LazyEditProfile />
    </Suspense>
  );
}
