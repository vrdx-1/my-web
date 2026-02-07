'use client';

import React, { createContext, useCallback, useRef, useContext } from 'react';

type BackStep = () => void;

interface BackHandlerContextValue {
  /** ใช้ใน BackHandler: อ้างอิง stack สำหรับ popstate */
  backStackRef: React.MutableRefObject<BackStep[]>;
  /** หน้าใดก็ตามที่เปิด overlay เรียก addBackStep(closeFn) เมื่อเปิด และ return cleanup เมื่อปิด */
  addBackStep: (close: BackStep) => () => void;
}

const BackHandlerContext = createContext<BackHandlerContextValue | null>(null);

export function useBackHandler(): BackHandlerContextValue {
  const ctx = useContext(BackHandlerContext);
  if (!ctx) return { backStackRef: { current: [] }, addBackStep: () => () => {} };
  return ctx;
}

export function BackHandlerProvider({ children }: { children: React.ReactNode }) {
  const backStackRef = useRef<BackStep[]>([]);

  const addBackStep = useCallback((close: BackStep) => {
    backStackRef.current = [...backStackRef.current, close];
    return () => {
      backStackRef.current = backStackRef.current.filter((f) => f !== close);
    };
  }, []);

  const value: BackHandlerContextValue = { backStackRef, addBackStep };

  return (
    <BackHandlerContext.Provider value={value}>
      {children}
    </BackHandlerContext.Provider>
  );
}
