'use client';

import React, { createContext, useRef, useContext, useCallback } from 'react';

type CreatePostHandler = () => void;

interface CreatePostContextValue {
  register: (handler: CreatePostHandler | null) => void;
  trigger: () => void;
}

const CreatePostContext = createContext<CreatePostContextValue | null>(null);

export function CreatePostProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<CreatePostHandler | null>(null);

  const register = useCallback((handler: CreatePostHandler | null) => {
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
    <CreatePostContext.Provider value={value}>
      {children}
    </CreatePostContext.Provider>
  );
}

export function useCreatePostContext() {
  return useContext(CreatePostContext);
}
