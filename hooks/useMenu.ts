'use client'

import { useState, useEffect, useRef } from 'react';

interface UseMenuReturn {
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  setActiveMenu: (postId: string | null) => void;
  setIsMenuAnimating: (animating: boolean) => void;
}

export function useMenu(): UseMenuReturn {
  const [activeMenuState, setActiveMenu] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // ปิดเมนูไข่ปลาเมื่อเลื่อนหน้าจอ
  useEffect(() => {
    const handleScroll = () => {
      if (activeMenuState) {
        setIsMenuAnimating(true);
        setTimeout(() => {
          setActiveMenu(null);
          setIsMenuAnimating(false);
        }, 300);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMenuState]);

  // ปิดเมนูไข่ปลาเมื่อคลิกที่อื่น
  useEffect(() => {
    if (!activeMenuState) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = (e.target || (e as TouchEvent).touches?.[0]?.target) as HTMLElement;
      if (!target) return;
      // ตรวจสอบว่า element ที่คลิกอยู่นอกเมนูและไม่ใช่ปุ่มไข่ปลาหรือไม่
      if (!target.closest('[data-menu-container]') && !target.closest('[data-menu-button]')) {
        setIsMenuAnimating(true);
        setTimeout(() => {
          setActiveMenu(null);
          setIsMenuAnimating(false);
        }, 300);
      }
    };
    document.addEventListener('mousedown', handleClickOutside as EventListener);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [activeMenuState]);

  return {
    activeMenuState,
    isMenuAnimating,
    menuButtonRefs,
    setActiveMenu,
    setIsMenuAnimating,
  };
}
