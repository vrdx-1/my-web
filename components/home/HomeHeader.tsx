'use client';

import React, { useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { HomeHeaderSearchAndFilter } from '@/components/home/HomeHeaderSearchAndFilter';
import { APP_HEADER_PRESET } from '@/utils/appHeaderPreset';

export type HomeHeaderProps = React.ComponentProps<typeof AppHeader>;

function HomeHeaderBase(props: HomeHeaderProps) {
  const homeCenterContent = useMemo(
    () => (props.showOnlySearch ? <HomeHeaderSearchAndFilter /> : undefined),
    [props.showOnlySearch]
  );

  return <AppHeader {...APP_HEADER_PRESET} {...props} homeCenterContent={homeCenterContent} />;
}

export const HomeHeader = React.memo(HomeHeaderBase);
