'use client';

import React, { createContext, useCallback, useRef, useContext, useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const MAIN_TAB_PATHS = ['/home', '/notification', '/profile'] as const;
type MainTabId = (typeof MAIN_TAB_PATHS)[number];

const STORAGE_KEY_PREFIX = 'mainTabScroll_';

type GetScroll = () => number;
type SetScroll = (y: number) => void;

interface ScrollEntry {
  getScroll: GetScroll;
  setScroll: SetScroll;
}

export type { MainTabId };

interface MainTabScrollContextValue {
  registerScroll: (tabId: MainTabId, getScroll: GetScroll, setScroll: SetScroll) => void;
  unregisterScroll: (tabId: MainTabId) => void;
  /** เรียกก่อน router.push เพื่อบันทึก scroll ของ tab ปัจจุบัน */
  saveCurrentScroll: (tabId: MainTabId) => void;
  /** เรียกหลัง registerScroll แล้ว เพื่อคืนค่า scroll (ใช้ในหน้าแจ้งเตือนที่ลงทะเบียนใน useLayoutEffect หลัง context) */
  restoreScrollForTab: (tabId: MainTabId) => void;
  /** ใช้ใน panel เพื่อรู้ว่า tab นี้เป็นหน้าปัจจุบันหรือไม่ (สำหรับหยุดโหลดเมื่อไม่แสดง) */
  activeTabId: MainTabId | null;
}

const MainTabScrollContext = createContext<MainTabScrollContextValue | null>(null);

function getStoredScroll(tabId: MainTabId): number | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const s = sessionStorage.getItem(STORAGE_KEY_PREFIX + tabId);
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function setStoredScroll(tabId: MainTabId, y: number) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + tabId, String(y));
  } catch {
    // ignore
  }
}

export function MainTabScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const registryRef = useRef<Map<MainTabId, ScrollEntry>>(new Map());
  const savedScrollRef = useRef<Partial<Record<MainTabId, number>>>({});

  const registerScroll = useCallback((tabId: MainTabId, getScroll: GetScroll, setScroll: SetScroll) => {
    registryRef.current.set(tabId, { getScroll, setScroll });
  }, []);

  const unregisterScroll = useCallback((tabId: MainTabId) => {
    registryRef.current.delete(tabId);
  }, []);

  const saveCurrentScroll = useCallback((tabId: MainTabId) => {
    const entry = registryRef.current.get(tabId);
    if (entry) {
      try {
        const y = entry.getScroll();
        if (typeof y === 'number' && Number.isFinite(y)) {
          savedScrollRef.current[tabId] = y;
          setStoredScroll(tabId, y);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const getSavedScroll = useCallback((tabId: MainTabId): number | undefined => {
    const fromRef = savedScrollRef.current[tabId];
    if (typeof fromRef === 'number' && Number.isFinite(fromRef)) return fromRef;
    return getStoredScroll(tabId);
  }, []);

  const restoreScrollForTab = useCallback((tabId: MainTabId) => {
    const entry = registryRef.current.get(tabId);
    if (!entry) return;
    const toRestore = getSavedScroll(tabId);
    if (typeof toRestore !== 'number' || !Number.isFinite(toRestore)) return;
    try {
      entry.setScroll(toRestore);
    } catch {
      // ignore
    }
  }, [getSavedScroll]);

  const activeTabId: MainTabId | null =
    pathname === '/home' || pathname === '/notification' || pathname === '/profile' ? pathname : null;

  const prevTabIdRef = useRef<MainTabId | null>(null);

  /** เมื่อ pathname เปลี่ยน: คืนค่า scroll ก่อน paint — ให้เห็นจุดเดิมทันที (ใช้ sessionStorage เป็น fallback เผื่อ context ถูก remount ตอน deploy) */
  useLayoutEffect(() => {
    const registry = registryRef.current;
    prevTabIdRef.current = activeTabId;

    if (!activeTabId) return;
    const entry = registry.get(activeTabId);
    if (entry) {
      const toRestore = getSavedScroll(activeTabId);
      if (typeof toRestore === 'number' && Number.isFinite(toRestore)) {
        try {
          entry.setScroll(toRestore);
        } catch {
          // ignore
        }
      }
    }
  }, [activeTabId, getSavedScroll]);

  const value: MainTabScrollContextValue = {
    registerScroll,
    unregisterScroll,
    saveCurrentScroll,
    restoreScrollForTab,
    activeTabId,
  };

  return (
    <MainTabScrollContext.Provider value={value}>
      {children}
    </MainTabScrollContext.Provider>
  );
}

export function useMainTabScroll() {
  return useContext(MainTabScrollContext);
}

