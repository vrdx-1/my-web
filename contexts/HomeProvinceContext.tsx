'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

/** ค่าว่าง '' = "ທຸກແຂວງ" (default ของ home province picker). ไม่ persist — ทุกครั้งที่ refresh/เข้าเว็บใหม่ เป็น "ທຸກແຂວງ" เสมอ */
interface HomeProvinceContextValue {
  selectedProvince: string;
  setSelectedProvince: (v: string) => void;
  minPriceKip: number | null;
  maxPriceKip: number | null;
  setPriceRange: (minPriceKip: number | null, maxPriceKip: number | null) => void;
  resetFilters: () => void;
}

const HomeProvinceContext = createContext<HomeProvinceContextValue | null>(null);

export function HomeProvinceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvince, setState] = useState<string>('');
  const [minPriceKip, setMinPriceKip] = useState<number | null>(null);
  const [maxPriceKip, setMaxPriceKip] = useState<number | null>(null);

  const setSelectedProvince = useCallback((v: string) => setState(v), []);
  const setPriceRange = useCallback((min: number | null, max: number | null) => {
    setMinPriceKip(min);
    setMaxPriceKip(max);
  }, []);
  const resetFilters = useCallback(() => {
    setState('');
    setMinPriceKip(null);
    setMaxPriceKip(null);
  }, []);

  return (
    <HomeProvinceContext.Provider
      value={{ selectedProvince, setSelectedProvince, minPriceKip, maxPriceKip, setPriceRange, resetFilters }}
    >
      {children}
    </HomeProvinceContext.Provider>
  );
}

export function useHomeProvince() {
  return useContext(HomeProvinceContext);
}
