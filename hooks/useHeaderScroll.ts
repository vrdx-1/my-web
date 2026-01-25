'use client'

import { useState, useEffect } from 'react';

interface UseHeaderScrollReturn {
  isHeaderVisible: boolean;
  lastScrollY: number;
  setIsHeaderVisible: (visible: boolean) => void;
}

export function useHeaderScroll(): UseHeaderScrollReturn {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY);
      
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80 && scrollDelta > 5) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY && scrollDelta > 5) {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return {
    isHeaderVisible,
    lastScrollY,
    setIsHeaderVisible,
  };
}
