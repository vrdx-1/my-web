'use client';

import React, { createContext, useRef, useContext, useCallback, useMemo, useState } from 'react';

type CreatePostHandler = () => void;

interface CreatePostDraft {
  files: File[];
  layout: string;
}

interface CreatePostContextValue {
  register: (handler: CreatePostHandler | null) => void;
  trigger: () => void;
  draft: CreatePostDraft;
  setDraft: (draft: CreatePostDraft) => void;
  clearDraft: () => void;
}

const CreatePostContext = createContext<CreatePostContextValue | null>(null);

export function CreatePostProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<CreatePostHandler | null>(null);
  const [draft, setDraftState] = useState<CreatePostDraft>({
    files: [],
    layout: 'default',
  });

  const register = useCallback((handler: CreatePostHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const trigger = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const setDraft = useCallback((nextDraft: CreatePostDraft) => {
    const normalizedFiles = nextDraft.files.slice(0, 30);
    const normalizedLayout = nextDraft.layout || 'default';
    setDraftState((prev) => {
      const isSameLayout = prev.layout === normalizedLayout;
      const isSameFiles =
        prev.files.length === normalizedFiles.length &&
        prev.files.every((file, index) => file === normalizedFiles[index]);

      if (isSameLayout && isSameFiles) {
        return prev;
      }

      return {
        files: normalizedFiles,
        layout: normalizedLayout,
      };
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState((prev) => {
      if (prev.files.length === 0 && prev.layout === 'default') {
        return prev;
      }
      return { files: [], layout: 'default' };
    });
  }, []);

  const value = useMemo(
    () => ({ register, trigger, draft, setDraft, clearDraft }),
    [register, trigger, draft, setDraft, clearDraft],
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
