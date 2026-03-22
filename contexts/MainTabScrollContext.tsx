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
  /** หน้าโฮมบน iPhone: scroll อยู่ที่กล่องภายใน ไม่ใช่ window — อัปเดตตำแหน่งล่าสุดให้ตรงกับ sessionStorage */
  notifyTabScrollPosition: (tabId: MainTabId, y: number) => void;
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

/** อ่านค่าที่บันทึกไว้ (เช่น ก่อน retry คืน scroll หน้าโฮมหลังฟีดพร้อม) */
export function readMainTabScrollStorage(tabId: MainTabId): number | undefined {
  return getStoredScroll(tabId);
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
  const pathnameRef = useRef<string | null>(pathname ?? null);
  pathnameRef.current = pathname ?? null;

  const registryRef = useRef<Map<MainTabId, ScrollEntry>>(new Map());
  const savedScrollRef = useRef<Partial<Record<MainTabId, number>>>({});
  /** ตำแหน่งล่าสุดขณะอยู่แท็บหลัก — ใช้แทน window.scrollY ตอนออกจากหน้า (Next อาจรีเซ็ต scroll ก่อน effect cleanup) */
  const lastWindowScrollByTabRef = useRef<Partial<Record<MainTabId, number>>>({});
  const prevPathnameForPersistRef = useRef<string | null>(null);

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

  const notifyTabScrollPosition = useCallback((tabId: MainTabId, y: number) => {
    if (tabId !== '/home' && tabId !== '/notification' && tabId !== '/profile') return;
    if (typeof y !== 'number' || !Number.isFinite(y)) return;
    lastWindowScrollByTabRef.current[tabId] = y;
  }, []);

  const activeTabId: MainTabId | null =
    pathname === '/home' || pathname === '/notification' || pathname === '/profile' ? pathname : null;

  const prevTabIdRef = useRef<MainTabId | null>(null);

  /** อัปเดตตำแหน่ง scroll ล่าสุดของแท็บหลัก — pathname อ่านจาก ref เพื่อไม่ให้ถูกเขียนทับเมื่อ Next รีเซ็ต scroll หลังนำทาง */
  useEffect(() => {
    const onScroll = () => {
      const p = pathnameRef.current;
      if (p !== '/home' && p !== '/notification' && p !== '/profile') return;
      const entry = registryRef.current.get(p as MainTabId);
      const y = entry ? entry.getScroll() : window.scrollY;
      lastWindowScrollByTabRef.current[p as MainTabId] = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** ออกจาก /home (หรือแท็บหลักอื่น) ไปหน้าย่อย — บันทึก scroll ลง ref + sessionStorage (กรณีไม่ได้ผ่าน BottomNav.saveCurrentScroll) */
  useLayoutEffect(() => {
    const prev = prevPathnameForPersistRef.current;
    const current = pathname ?? null;
    prevPathnameForPersistRef.current = current;
    if (prev == null) return;
    if (prev !== '/home' && prev !== '/notification' && prev !== '/profile') return;
    if (current === prev) return;
    const left = prev as MainTabId;
    const y = lastWindowScrollByTabRef.current[left];
    if (typeof y === 'number' && Number.isFinite(y)) {
      savedScrollRef.current[left] = y;
      setStoredScroll(left, y);
    }
  }, [pathname]);

  /** เมื่อ pathname เปลี่ยน: คืนค่า scroll ก่อน paint — ให้เห็นจุดเดิมทันที (ใช้ sessionStorage เป็น fallback เผื่อ context ถูก remount ตอน deploy) */
  useLayoutEffect(() => {
    const registry = registryRef.current;
    prevTabIdRef.current = activeTabId;

    if (!activeTabId) return;
    /** /home รอ header + virtual feed สูงพอก่อน — คืนใน HomePageContent (retry) */
    if (activeTabId === '/home') return;
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

  /** ให้ lastWindowScrollByTabRef ตรงกับตำแหน่งเลื่อนจริง (window หรือกล่องโฮมบน iPhone) */
  useLayoutEffect(() => {
    if (!activeTabId) return;
    try {
      const entry = registryRef.current.get(activeTabId);
      const y = entry ? entry.getScroll() : window.scrollY;
      lastWindowScrollByTabRef.current[activeTabId] = y;
    } catch {
      // ignore
    }
  }, [activeTabId]);

  const value: MainTabScrollContextValue = {
    registerScroll,
    unregisterScroll,
    saveCurrentScroll,
    restoreScrollForTab,
    notifyTabScrollPosition,
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

