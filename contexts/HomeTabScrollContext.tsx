'use client';

import React, { createContext, useRef, useContext, useCallback } from 'react';

type SaveBeforeSwitch = () => void;

interface HomeTabScrollContextValue {
  /** ref ที่ HomePageContent ใส่ฟังก์ชันบันทึก scroll ของแท็บปัจจุบัน — เรียกก่อน triggerTabChange (แบบเดียวกับ saveCurrentScroll ก่อน router.push) */
  saveBeforeSwitchRef: React.MutableRefObject<SaveBeforeSwitch | null>;
  /** เรียกก่อนสลับแท็บพร้อมขาย/ขายแล้ว */
  saveCurrentHomeTabScroll: () => void;
}

const HomeTabScrollContext = createContext<HomeTabScrollContextValue | null>(null);

export function HomeTabScrollProvider({ children }: { children: React.ReactNode }) {
  const saveBeforeSwitchRef = useRef<SaveBeforeSwitch | null>(null);

  const saveCurrentHomeTabScroll = useCallback(() => {
    saveBeforeSwitchRef.current?.();
  }, []);

  const value: HomeTabScrollContextValue = {
    saveBeforeSwitchRef,
    saveCurrentHomeTabScroll,
  };

  return (
    <HomeTabScrollContext.Provider value={value}>
      {children}
    </HomeTabScrollContext.Provider>
  );
}

export function useHomeTabScroll() {
  return useContext(HomeTabScrollContext);
}
