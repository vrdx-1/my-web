'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface HeaderVisibilityContextValue {
  isHeaderVisible: boolean;
  setHeaderVisible: (visible: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextValue | null>(null);

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const setHeaderVisibleStable = useCallback((visible: boolean) => {
    setHeaderVisible(visible);
  }, []);
  const value: HeaderVisibilityContextValue = {
    isHeaderVisible,
    setHeaderVisible: setHeaderVisibleStable,
  };
  return (
    <HeaderVisibilityContext.Provider value={value}>
      {children}
    </HeaderVisibilityContext.Provider>
  );
}

export function useHeaderVisibilityContext() {
  return useContext(HeaderVisibilityContext);
}
