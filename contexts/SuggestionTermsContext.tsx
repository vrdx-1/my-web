"use client";
import React, { createContext, useContext, useMemo } from 'react';
import { ALL_SUGGESTION_TERMS, ALL_SUGGESTION_TERMS_SET } from '@/utils/suggestionTermsIndex';

// Context type
interface SuggestionTermsContextType {
  allTerms: string[];
  allTermsSet: Set<string>;
}

const SuggestionTermsContext = createContext<SuggestionTermsContextType | undefined>(undefined);

export const SuggestionTermsProvider = ({ children }: { children: React.ReactNode }) => {
  // Preload terms in memory, memoized for performance
  const value = useMemo(() => ({
    allTerms: ALL_SUGGESTION_TERMS,
    allTermsSet: ALL_SUGGESTION_TERMS_SET,
  }), []);

  return (
    <SuggestionTermsContext.Provider value={value}>
      {children}
    </SuggestionTermsContext.Provider>
  );
};

export function useSuggestionTerms() {
  const ctx = useContext(SuggestionTermsContext);
  if (!ctx) throw new Error('useSuggestionTerms must be used within SuggestionTermsProvider');
  return ctx;
}
