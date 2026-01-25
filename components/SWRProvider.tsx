'use client'

import { SWRConfig } from 'swr';
import { swrFetcher } from '@/utils/swrFetcher';

/**
 * SWR Provider Component
 * Provides global SWR configuration with caching
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 2000, // Dedupe requests within 2 seconds
        focusThrottleInterval: 5000, // Throttle focus revalidation to 5 seconds
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        // Cache configuration
        provider: () => {
          // Use Map for in-memory cache
          return new Map();
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
