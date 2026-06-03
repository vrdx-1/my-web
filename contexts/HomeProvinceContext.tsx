'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type HomePriceSortOrder = '' | 'asc' | 'desc';

/** ค่าว่าง '' = "ທຸກແຂວງ" (default ของ home province picker). ไม่ persist — ทุกครั้งที่ refresh/เข้าเว็บใหม่ เป็น "ທຸກແຂວງ" เสมอ */
interface HomeProvinceContextValue {
  selectedProvince: string;
  setSelectedProvince: (v: string) => void;
  minPriceKip: number | null;
  maxPriceKip: number | null;
  priceSortOrder: HomePriceSortOrder;
  setPriceRange: (minPriceKip: number | null, maxPriceKip: number | null) => void;
  setPriceSortOrder: (order: HomePriceSortOrder) => void;
  resetFilters: () => void;
}

const HomeProvinceContext = createContext<HomeProvinceContextValue | null>(null);

export function HomeProvinceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvince, setState] = useState<string>('');
  const [minPriceKip, setMinPriceKip] = useState<number | null>(null);
  const [maxPriceKip, setMaxPriceKip] = useState<number | null>(null);
  const [priceSortOrder, setPriceSortOrderState] = useState<HomePriceSortOrder>('');

  const setSelectedProvince = useCallback((v: string) => setState(v), []);
  const setPriceRange = useCallback((min: number | null, max: number | null) => {
    setMinPriceKip(min);
    setMaxPriceKip(max);
  }, []);
  const setPriceSortOrder = useCallback((order: HomePriceSortOrder) => {
    setPriceSortOrderState(order);
  }, []);
  const resetFilters = useCallback(() => {
    setState('');
    setMinPriceKip(null);
    setMaxPriceKip(null);
    setPriceSortOrderState('');
  }, []);

  return (
    <HomeProvinceContext.Provider
      value={{
        selectedProvince,
        setSelectedProvince,
        minPriceKip,
        maxPriceKip,
        priceSortOrder,
        setPriceRange,
        setPriceSortOrder,
        resetFilters,
      }}
    >
      {children}
    </HomeProvinceContext.Provider>
  );
}

export function useHomeProvince() {
  return useContext(HomeProvinceContext);
}
