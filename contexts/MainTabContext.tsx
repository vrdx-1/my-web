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
  navigatingToTab: MainTab | null;
  setNavigatingToTab: (v: MainTab | null) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
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
  const [navigatingToTab, setNavigatingToTab] = useState<MainTab | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchScreenOpen, setIsSearchScreenOpen] = useState(false);
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
    navigatingToTab,
    setNavigatingToTab,
    searchTerm,
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
