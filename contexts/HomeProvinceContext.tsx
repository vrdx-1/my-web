'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { CurrencySymbol } from '@/utils/exchangeRates';

export type HomePriceSortOrder = '' | 'asc' | 'desc' | 'latest';

/** ค่าว่าง '' = "ທຸກແຂວງ" (default ของ home province picker). ไม่ persist — ทุกครั้งที่ refresh/เข้าเว็บใหม่ เป็น "ທຸກແຂວງ" เสมอ */
interface HomeProvinceContextValue {
  selectedProvince: string;
  setSelectedProvince: (v: string) => void;
  minPriceKip: number | null;
  maxPriceKip: number | null;
  minPriceDisplay: number | null;
  maxPriceDisplay: number | null;
  priceSortOrder: HomePriceSortOrder;
  displayCurrency: CurrencySymbol;
  setPriceRange: (
    minPriceKip: number | null,
    maxPriceKip: number | null,
    minPriceDisplay?: number | null,
    maxPriceDisplay?: number | null,
  ) => void;
  setPriceSortOrder: (order: HomePriceSortOrder) => void;
  setDisplayCurrency: (currency: CurrencySymbol) => void;
  resetFilters: () => void;
}

const HomeProvinceContext = createContext<HomeProvinceContextValue | null>(null);

export function HomeProvinceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvince, setState] = useState<string>('');
  const [minPriceKip, setMinPriceKip] = useState<number | null>(null);
  const [maxPriceKip, setMaxPriceKip] = useState<number | null>(null);
  const [minPriceDisplay, setMinPriceDisplay] = useState<number | null>(null);
  const [maxPriceDisplay, setMaxPriceDisplay] = useState<number | null>(null);
  const [priceSortOrder, setPriceSortOrderState] = useState<HomePriceSortOrder>('');
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencySymbol>('₭');

  const setSelectedProvince = useCallback((v: string) => setState(v), []);
  const setPriceRange = useCallback((
    min: number | null,
    max: number | null,
    nextMinDisplay: number | null = null,
    nextMaxDisplay: number | null = null,
  ) => {
    setMinPriceKip(min);
    setMaxPriceKip(max);
    setMinPriceDisplay(nextMinDisplay);
    setMaxPriceDisplay(nextMaxDisplay);
  }, []);
  const setPriceSortOrder = useCallback((order: HomePriceSortOrder) => {
    setPriceSortOrderState(order);
  }, []);
  const setDisplayCurrency = useCallback((currency: CurrencySymbol) => {
    setDisplayCurrencyState(currency);
  }, []);
  const resetFilters = useCallback(() => {
    setState('');
    setMinPriceKip(null);
    setMaxPriceKip(null);
    setMinPriceDisplay(null);
    setMaxPriceDisplay(null);
    setPriceSortOrderState('');
    setDisplayCurrencyState('₭');
  }, []);

  return (
    <HomeProvinceContext.Provider
      value={{
        selectedProvince,
        setSelectedProvince,
        minPriceKip,
        maxPriceKip,
        minPriceDisplay,
        maxPriceDisplay,
        priceSortOrder,
        displayCurrency,
        setPriceRange,
        setPriceSortOrder,
        setDisplayCurrency,
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
