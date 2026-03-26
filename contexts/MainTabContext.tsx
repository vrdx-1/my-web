'use client';

import React, { createContext, useCallback, useRef, useContext, useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';

export type TabRefreshOptions = { fromHomeButton?: boolean };
export type MainTab = 'recommend' | 'sold';

interface TabChangeRequest {
  requestId: number;
  tab: MainTab;
}

interface TabRefreshRequest {
  requestId: number;
  options?: TabRefreshOptions;
}

interface MainTabContextValue {
  /** แท็บ Home ปัจจุบัน (ພ້ອມຂາຍ | ຂາຍແລ້ວ) */
  homeTab: MainTab;
  setHomeTab: (v: MainTab) => void;
  triggerTabChange: (tab: MainTab) => void;
  triggerTabRefresh: (options?: TabRefreshOptions) => void;
  tabChangeRequest: TabChangeRequest | null;
  tabRefreshRequest: TabRefreshRequest | null;
  tabRefreshing: boolean;
  setTabRefreshing: (v: boolean) => void;
  navigatingToTab: MainTab | null;
  setNavigatingToTab: (v: MainTab | null) => void;
  isProfileOverlayOpen: boolean;
  setProfileOverlayOpen: (v: boolean) => void;
}

const MainTabContext = createContext<MainTabContextValue | null>(null);

const HOME_TAB_DEFAULT: MainTab = 'recommend';

export function MainTabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabChangeRequestIdRef = useRef(0);
  const tabRefreshRequestIdRef = useRef(0);
  const [homeTab, setHomeTabState] = useState<MainTab>(HOME_TAB_DEFAULT);
  const [tabChangeRequest, setTabChangeRequest] = useState<TabChangeRequest | null>(null);
  const [tabRefreshRequest, setTabRefreshRequest] = useState<TabRefreshRequest | null>(null);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [navigatingToTab, setNavigatingToTab] = useState<MainTab | null>(null);
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

  const triggerTabChange = useCallback((tab: MainTab) => {
    setHomeTabState(tab);
    tabChangeRequestIdRef.current += 1;
    setTabChangeRequest({
      requestId: tabChangeRequestIdRef.current,
      tab,
    });
  }, []);

  const triggerTabRefresh = useCallback((options?: TabRefreshOptions) => {
    tabRefreshRequestIdRef.current += 1;
    setTabRefreshRequest({
      requestId: tabRefreshRequestIdRef.current,
      options,
    });
  }, []);

  const value = useMemo<MainTabContextValue>(
    () => ({
      homeTab,
      setHomeTab,
      triggerTabChange,
      triggerTabRefresh,
      tabChangeRequest,
      tabRefreshRequest,
      tabRefreshing,
      setTabRefreshing,
      navigatingToTab,
      setNavigatingToTab,
      isProfileOverlayOpen,
      setProfileOverlayOpen,
    }),
    [
      homeTab,
      setHomeTab,
      triggerTabChange,
      triggerTabRefresh,
      tabChangeRequest,
      tabRefreshRequest,
      tabRefreshing,
      navigatingToTab,
      isProfileOverlayOpen,
    ],
  );

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
