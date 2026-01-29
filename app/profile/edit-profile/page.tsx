'use client'
import { Suspense } from 'react';
import { PageLoadingFallback, dynamicNamed } from '@/utils/lazyLoad';

// Lazy load EditProfileContent with real code splitting
const LazyEditProfile = dynamicNamed(() => import('./EditProfileContent'), 'EditProfileContent', { ssr: true });

export default function EditProfile() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazyEditProfile />
    </Suspense>
  );
}
