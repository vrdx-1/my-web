'use client';

import { MainTabProvider } from '@/contexts/MainTabContext';
import { MainTabLayoutClient } from './MainTabLayoutClient';

/**
 * Shared layout for / (home) and /home.
 * Keeps the same header mounted when switching tabs so it doesn't blink.
 */
export default function MainTabLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainTabProvider>
      <MainTabLayoutClient>{children}</MainTabLayoutClient>
    </MainTabProvider>
  );
}
