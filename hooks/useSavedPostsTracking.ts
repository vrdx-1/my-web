'use client';

import { useState, useCallback } from 'react';

interface UseSavedPostsTrackingReturn {
  justSavedPosts: { [key: string]: boolean };
  setJustSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  markPostJustSaved: (postId: string) => void;
  clearJustSaved: (postId?: string) => void;
}

/**
 * จัดการการแสดง animation เพื่อบ่งบอกว่า post ถูก save ไปเมื่อเร็ว ๆ นี้
 * - markPostJustSaved: ตั้งค่า postId เป็น saved จากการ UI click
 * - clearJustSaved: ลบ single postId หรือ clear ทั้งหมด
 * auto-clear อยู่ใน component ที่ใช้ (PostCard animation)
 */
export function useSavedPostsTracking(): UseSavedPostsTrackingReturn {
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});

  const markPostJustSaved = useCallback((postId: string) => {
    setJustSavedPosts((prev) => ({
      ...prev,
      [postId]: true,
    }));
  }, []);

  const clearJustSaved = useCallback((postId?: string) => {
    if (postId === undefined) {
      setJustSavedPosts({});
    } else {
      setJustSavedPosts((prev) => {
        const copy = { ...prev };
        delete copy[postId];
        return copy;
      });
    }
  }, []);

  return {
    justSavedPosts,
    setJustSavedPosts,
    markPostJustSaved,
    clearJustSaved,
  };
}
