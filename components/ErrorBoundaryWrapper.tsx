'use client'

import { ErrorBoundary } from './ErrorBoundary';

/**
 * Client-side wrapper for ErrorBoundary
 * Required because ErrorBoundary needs to be a client component
 */
export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
