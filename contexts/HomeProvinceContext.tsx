'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

/** ค่าว่าง '' = "ທຸກແຂວງ" (default ของ home province picker). ไม่ persist — ทุกครั้งที่ refresh/เข้าเว็บใหม่ เป็น "ທຸກແຂວງ" เสมอ */
interface HomeProvinceContextValue {
  selectedProvince: string;
  setSelectedProvince: (v: string) => void;
}

const HomeProvinceContext = createContext<HomeProvinceContextValue | null>(null);

export function HomeProvinceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvince, setState] = useState<string>('');

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
