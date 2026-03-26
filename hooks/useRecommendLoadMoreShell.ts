'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseRecommendLoadMoreShellOptions {
  postListLoadingMore: boolean;
  isSoldTabNoSearch: boolean;
  selectedProvince: string;
}

interface UseRecommendLoadMoreShellReturn {
  shell: boolean;
  triggerLoadMore: () => void;
}

/**
 * จัดการแสดง skeleton ขณะรอการโหลดโพสเพิ่มเติม
 * รวม 4 effects เข้าไว้ใน hook เดียว:
 * - reset เมื่อ postList.loadingMore = true
 * - reset เมื่อสลับมากแท็บขายแล้ว
 * - reset เมื่อเปลี่ยนจังหวัด
 * - auto-reset หลังจาก 8s ถ้ายังไม่มี loadingMore
 */
export function useRecommendLoadMoreShell(
  options: UseRecommendLoadMoreShellOptions
): UseRecommendLoadMoreShellReturn {
  const { postListLoadingMore, isSoldTabNoSearch, selectedProvince } = options;
  const [shell, setShell] = useState(false);

  const triggerLoadMore = useCallback(() => {
    setShell(true);
  }, []);

  // Reset เมื่อ API เริ่มโหลดจริง
  useEffect(() => {
    if (postListLoadingMore) {
      setShell(false);
    }
  }, [postListLoadingMore]);

  // Reset เมื่อสลับมากแท็บขายแล้ว
  useEffect(() => {
    if (isSoldTabNoSearch) {
      setShell(false);
    }
  }, [isSoldTabNoSearch]);

  // Reset เมื่อเปลี่ยนจังหวัด
  useEffect(() => {
    setShell(false);
  }, [selectedProvince]);

  // Auto-reset หลังจาก 8s ถ้า API ไม่ตอบสนอง
  useEffect(() => {
    if (!shell) return;
    const timeoutId = window.setTimeout(() => setShell(false), 8000);
    return () => clearTimeout(timeoutId);
  }, [shell]);

  return { shell, triggerLoadMore };
}
