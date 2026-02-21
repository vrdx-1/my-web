'use client';

import React from 'react';
import { AppHeader } from '@/components/AppHeader';
import { APP_HEADER_PRESET } from '@/utils/appHeaderPreset';

export type HomeHeaderProps = React.ComponentProps<typeof AppHeader>;

export function HomeHeader(props: HomeHeaderProps) {
  return <AppHeader {...APP_HEADER_PRESET} {...props} />;
}
