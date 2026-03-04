'use client';

import React, { createContext, useContext, useState } from 'react';

export interface FirstFeedLoadedValue {
  firstFeedLoaded: boolean;
  setFirstFeedLoaded: (v: boolean) => void;
}

const FirstFeedLoadedContext = createContext<FirstFeedLoadedValue | null>(null);

export function FirstFeedLoadedProvider({ children }: { children: React.ReactNode }) {
  const [firstFeedLoaded, setFirstFeedLoaded] = useState(false);
  return (
    <FirstFeedLoadedContext.Provider value={{ firstFeedLoaded, setFirstFeedLoaded }}>
      {children}
    </FirstFeedLoadedContext.Provider>
  );
}

export function useFirstFeedLoaded() {
  const ctx = useContext(FirstFeedLoadedContext);
  return {
    firstFeedLoaded: ctx?.firstFeedLoaded ?? false,
    setFirstFeedLoaded: ctx?.setFirstFeedLoaded ?? (() => {}),
  };
}
