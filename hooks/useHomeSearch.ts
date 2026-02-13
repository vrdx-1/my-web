'use client'

import { useState, useEffect } from 'react';

/**
 * Custom hook สำหรับจัดการ search logic ในหน้า Home
 * แยก logic เพื่อลดความซับซ้อนของ HomeContent
 */
export function useHomeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearchScreenOpen, setIsSearchScreenOpen] = useState(false);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    isSearchScreenOpen,
    setIsSearchScreenOpen,
  };
}
