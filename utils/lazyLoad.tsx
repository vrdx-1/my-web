'use client'

import React from 'react';
import dynamic, { type DynamicOptions } from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

/**
 * Standard full-page loading UI used by lazy-loaded pages.
 * Keep markup/styles identical to existing pages to preserve UX/UI.
 */
export function PageLoadingFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <LoadingSpinner />
    </div>
  );
}

/**
 * Lazy-load a named export via next/dynamic with the standard fallback.
 * Example: dynamicNamed(() => import('./HomeContent'), 'HomeContent', { ssr: true })
 */
export function dynamicNamed<TModule, TKey extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TKey,
  options: DynamicOptions<any> = {}
) {
  return dynamic(
    () => importer().then((mod: any) => ({ default: mod[exportName] })),
    {
      ssr: true,
      loading: () => <PageLoadingFallback />,
      ...options,
    }
  );
}

/**
 * Shared helper for React.lazy() of a named export.
 * (Useful in client-only pages like admin screens and modal layers.)
 */
export function lazyNamed<TModule, TKey extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TKey
): React.LazyExoticComponent<React.ComponentType<any>> {
  return React.lazy(() => importer().then((mod: any) => ({ default: mod[exportName] })));
}

