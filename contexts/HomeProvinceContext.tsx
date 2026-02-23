'use client';

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { safeParseJSON } from '@/utils/storageUtils';

const HOME_PROVINCE_STORAGE_KEY = 'home_filter_province';

/** ค่าว่าง '' = "ທຸກແຂວງ" (default ของ home province picker) */
interface HomeProvinceContextValue {
  selectedProvince: string;
  setSelectedProvince: (v: string) => void;
}

const HomeProvinceContext = createContext<HomeProvinceContextValue | null>(null);

export function HomeProvinceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvince, setState] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = safeParseJSON(HOME_PROVINCE_STORAGE_KEY, '');
      if (stored !== selectedProvince) setState(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HOME_PROVINCE_STORAGE_KEY, JSON.stringify(selectedProvince));
    } catch {
      // ignore
    }
  }, [selectedProvince]);

  const setSelectedProvince = useCallback((v: string) => setState(v), []);

  return (
    <HomeProvinceContext.Provider value={{ selectedProvince, setSelectedProvince }}>
      {children}
    </HomeProvinceContext.Provider>
  );
}

export function useHomeProvince() {
  return useContext(HomeProvinceContext);
}
