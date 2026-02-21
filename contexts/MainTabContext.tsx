'use client';

import React, { createContext, useCallback, useRef, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type TabRefreshOptions = { fromHomeButton?: boolean };
type TabRefreshHandler = (options?: TabRefreshOptions) => void;
type TabChangeHandler = (tab: MainTab) => void;
export type MainTab = 'recommend' | 'sold';

interface MainTabContextValue {
  /** แท็บ Home ปัจจุบัน (ພ້ອມຂາຍ | ຂາຍແລ້ວ) */
  homeTab: MainTab;
  setHomeTab: (v: MainTab) => void;
  registerTabChangeHandler: (handler: TabChangeHandler) => void;
  unregisterTabChangeHandler: () => void;
  triggerTabChange: (tab: MainTab) => void;
  registerTabRefreshHandler: (handler: TabRefreshHandler) => void;
  unregisterTabRefreshHandler: () => void;
  triggerTabRefresh: (options?: TabRefreshOptions) => void;
  tabRefreshing: boolean;
  setTabRefreshing: (v: boolean) => void;
  /** 'pull' = กำลัง refresh จากดึงลง, 'home' = refresh จากปุ่ม Home → แสดง Skeleton ในพื้นที่ feed */
  refreshSource: 'pull' | 'home' | null;
  setRefreshSource: (v: 'pull' | 'home' | null) => void;
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

const HOME_TAB_DEFAULT: MainTab = 'recommend';

export function MainTabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const handlerRef = useRef<TabRefreshHandler | null>(null);
  const tabChangeHandlerRef = useRef<TabChangeHandler | null>(null);
  const [homeTab, setHomeTabState] = useState<MainTab>(HOME_TAB_DEFAULT);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [refreshSource, setRefreshSource] = useState<'pull' | 'home' | null>(null);
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
    if (pathname === '/home') {
      const t = setTimeout(() => setNavigatingToTab(null), 0);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  const setHomeTab = useCallback((v: MainTab) => {
    setHomeTabState(v);
  }, []);

  const registerTabChangeHandler = useCallback((handler: TabChangeHandler) => {
    tabChangeHandlerRef.current = handler;
  }, []);

  const unregisterTabChangeHandler = useCallback(() => {
    tabChangeHandlerRef.current = null;
  }, []);

  const triggerTabChange = useCallback((tab: MainTab) => {
    setHomeTabState(tab);
    tabChangeHandlerRef.current?.(tab);
  }, []);

  const registerTabRefreshHandler = useCallback((handler: TabRefreshHandler) => {
    handlerRef.current = handler;
  }, []);

  const unregisterTabRefreshHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  const triggerTabRefresh = useCallback((options?: TabRefreshOptions) => {
    handlerRef.current?.(options);
  }, []);

  const value: MainTabContextValue = {
    homeTab,
    setHomeTab,
    registerTabChangeHandler,
    unregisterTabChangeHandler,
    triggerTabChange,
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
