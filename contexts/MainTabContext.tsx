'use client';

import React, { createContext, useCallback, useRef, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type TabRefreshHandler = () => void;
export type MainTab = 'recommend' | 'sold';

interface MainTabContextValue {
  registerTabRefreshHandler: (handler: TabRefreshHandler) => void;
  unregisterTabRefreshHandler: () => void;
  triggerTabRefresh: () => void;
  tabRefreshing: boolean;
  setTabRefreshing: (v: boolean) => void;
  /** 'pull' = กำลัง refresh จากดึงลง → ไม่แสดง loading บนแท็บ */
  refreshSource: 'pull' | null;
  setRefreshSource: (v: 'pull' | null) => void;
  /** px ที่ใช้ translate header+spacer ลงเมื่อดึง feed (ให้ header ถูกดึงลงด้วย) */
  pullHeaderOffset: number;
  setPullHeaderOffset: (v: number) => void;
  navigatingToTab: MainTab | null;
  setNavigatingToTab: (v: MainTab | null) => void;
  searchTerm: string;
  /** ข้อความที่แสดงในแท็บ/ช่องค้นหา (เช่น ລົດຍ້າຍພວງ) — logic ยังส่ง searchTerm ไป API เหมือนเดิม */
  searchDisplayText: string;
  /** apiTerm = ค่าที่ส่งไป DB, displayText = ค่าที่แสดงใน UI (ถ้าไม่ใส่ใช้ apiTerm) */
  setSearchTerm: (apiTerm: string, displayText?: string) => void;
  isSearchScreenOpen: boolean;
  setIsSearchScreenOpen: (v: boolean) => void;
  isProfileOverlayOpen: boolean;
  setProfileOverlayOpen: (v: boolean) => void;
}

const MainTabContext = createContext<MainTabContextValue | null>(null);

export function MainTabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const handlerRef = useRef<TabRefreshHandler | null>(null);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [refreshSource, setRefreshSource] = useState<'pull' | null>(null);
  const [pullHeaderOffset, setPullHeaderOffset] = useState(0);
  const [navigatingToTab, setNavigatingToTab] = useState<MainTab | null>(null);
  const [searchTerm, setSearchTermState] = useState('');
  const [searchDisplayText, setSearchDisplayText] = useState('');
  const [isSearchScreenOpen, setIsSearchScreenOpen] = useState(false);

  const setSearchTerm = useCallback((apiTerm: string, displayText?: string) => {
    setSearchTermState(apiTerm);
    setSearchDisplayText(displayText !== undefined ? displayText : apiTerm);
  }, []);
  const [isProfileOverlayOpen, setProfileOverlayOpen] = useState(false);

  // Clear navigating state when route has changed
  useEffect(() => {
    if (pathname === '/' || pathname === '/sold') {
      const t = setTimeout(() => setNavigatingToTab(null), 0);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  const registerTabRefreshHandler = useCallback((handler: TabRefreshHandler) => {
    handlerRef.current = handler;
  }, []);

  const unregisterTabRefreshHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  const triggerTabRefresh = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const value: MainTabContextValue = {
    registerTabRefreshHandler,
    unregisterTabRefreshHandler,
    triggerTabRefresh,
    tabRefreshing,
    setTabRefreshing,
    refreshSource,
    setRefreshSource,
    pullHeaderOffset,
    setPullHeaderOffset,
    navigatingToTab,
    setNavigatingToTab,
    searchTerm,
    searchDisplayText,
    setSearchTerm,
    isSearchScreenOpen,
    setIsSearchScreenOpen,
    isProfileOverlayOpen,
    setProfileOverlayOpen,
  };

  return (
    <MainTabContext.Provider value={value}>
      {children}
    </MainTabContext.Provider>
  );
}

export function useMainTabContext() {
  const ctx = useContext(MainTabContext);
  return ctx;
}
