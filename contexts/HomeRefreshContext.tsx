'use client';

import React, { createContext, useRef, useContext, useCallback } from 'react';

type HomeRefreshHandler = () => void;

interface HomeRefreshContextValue {
  register: (handler: HomeRefreshHandler | null) => void;
  trigger: () => void;
}

const HomeRefreshContext = createContext<HomeRefreshContextValue | null>(null);

export function HomeRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<HomeRefreshHandler | null>(null);

  const register = useCallback((handler: HomeRefreshHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const trigger = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const value = React.useMemo(
    () => ({ register, trigger }),
    [register, trigger],
  );

  return (
    <HomeRefreshContext.Provider value={value}>
      {children}
    </HomeRefreshContext.Provider>
  );
}

export function useHomeRefreshContext() {
  return useContext(HomeRefreshContext);
}
