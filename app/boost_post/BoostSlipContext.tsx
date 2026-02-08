"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type BoostResult = {
  dbStatus: string;
  expiresAt: string | null;
  justSubmitted: boolean;
  submitError: string | null;
};

type BoostSlipContextValue = {
  pendingSlipFile: File | null;
  previewUrl: string | null;
  setSlipFile: (file: File | null) => void;
  clearSlip: () => void;
  boostResult: BoostResult | null;
  setBoostResult: (r: BoostResult | null) => void;
};

const BoostSlipContext = createContext<BoostSlipContextValue | null>(null);

export function BoostSlipProvider({ children }: { children: ReactNode }) {
  const [pendingSlipFile, setPendingSlipFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [boostResult, setBoostResult] = useState<BoostResult | null>(null);

  const setSlipFile = useCallback((file: File | null) => {
    setPendingSlipFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const clearSlip = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingSlipFile(null);
  }, []);

  return (
    <BoostSlipContext.Provider
      value={{
        pendingSlipFile,
        previewUrl,
        setSlipFile,
        clearSlip,
        boostResult,
        setBoostResult,
      }}
    >
      {children}
    </BoostSlipContext.Provider>
  );
}

export function useBoostSlip() {
  const ctx = useContext(BoostSlipContext);
  if (!ctx) throw new Error("useBoostSlip must be used within BoostSlipProvider");
  return ctx;
}
