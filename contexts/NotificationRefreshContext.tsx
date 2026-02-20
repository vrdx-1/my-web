'use client';

import React, { createContext, useRef, useContext, useCallback } from 'react';

type NotificationRefreshHandler = () => void;

interface NotificationRefreshContextValue {
  register: (handler: NotificationRefreshHandler | null) => void;
  trigger: () => void;
}

const NotificationRefreshContext = createContext<NotificationRefreshContextValue | null>(null);

export function NotificationRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<NotificationRefreshHandler | null>(null);

  const register = useCallback((handler: NotificationRefreshHandler | null) => {
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
    <NotificationRefreshContext.Provider value={value}>
      {children}
    </NotificationRefreshContext.Provider>
  );
}

export function useNotificationRefreshContext() {
  return useContext(NotificationRefreshContext);
}
