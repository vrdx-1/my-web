'use client'

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/** แคชรายชื่อ Likes/Saves ต่อโพส — สลับแท็บแล้วโหลดไว้แล้วไม่แสดง Skeleton (แบบ Facebook) */
const INTERACTION_CACHE_MAX = 50;

function getCacheKey(postId: string, type: 'likes' | 'saves'): string {
  return `${postId}:${type}`;
}

interface UseInteractionModalReturn {
  // State
  interactionModal: { show: boolean; type: 'likes' | 'saves'; postId: string | null };
  interactionUsers: any[];
  isInteractionModalAnimating: boolean;
  interactionLoading: boolean;
  interactionSheetMode: 'half' | 'full' | 'hidden';
  startY: number;
  currentY: number;
  
  // Setters
  setInteractionModal: (modal: { show: boolean; type: 'likes' | 'saves'; postId: string | null }) => void;
  setStartY: (y: number) => void;
  setCurrentY: (y: number) => void;
  
  // Handlers
  fetchInteractions: (type: 'likes' | 'saves', postId: string, posts: any[]) => Promise<void>;
  onSheetTouchStart: (e: React.TouchEvent) => void;
  onSheetTouchMove: (e: React.TouchEvent) => void;
  onSheetTouchEnd: () => void;
  closeModal: () => void;
}

export function useInteractionModal(): UseInteractionModalReturn {
  const [interactionModal, setInteractionModal] = useState<{ show: boolean; type: 'likes' | 'saves'; postId: string | null }>({ 
    show: false, 
    type: 'likes', 
    postId: null 
  });
  const [interactionUsers, setInteractionUsers] = useState<any[]>([]);
  const [isInteractionModalAnimating, setIsInteractionModalAnimating] = useState(false);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionSheetMode, setInteractionSheetMode] = useState<'half' | 'full' | 'hidden'>('hidden');
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  const interactionCacheRef = useRef<Record<string, any[]>>({});

  const fetchInteractions = useCallback(async (type: 'likes' | 'saves', postId: string, _posts: any[]) => {
    const cacheKey = getCacheKey(postId, type);
    const cached = interactionCacheRef.current[cacheKey];
    const isSwitchingTab = interactionModal.show && interactionModal.postId === postId;

    if (cached !== undefined && isSwitchingTab) {
      setInteractionUsers(cached);
      setInteractionLoading(false);
      setInteractionModal({ show: true, type, postId });
      return;
    }

    setInteractionLoading(true);
    if (!isSwitchingTab) {
      setInteractionUsers([]);
      setInteractionSheetMode('half');
      setIsInteractionModalAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsInteractionModalAnimating(false);
        });
      });
    }
    setInteractionModal({ show: true, type, postId });

    try {
      const table = type === 'likes' ? 'post_likes' : 'post_saves';
      const guestTable = `${table}_guest`;
      const { data: userData } = await supabase
        .from(table)
        .select(`created_at, profiles:user_id(username, avatar_url)`)
        .eq('post_id', postId);
      const { data: guestData } = await supabase
        .from(guestTable)
        .select(`created_at`)
        .eq('post_id', postId);

      const formatted = [
        ...(userData || []).map((item: any) => ({
          username: item.profiles?.username || 'Unknown User',
          avatar_url: item.profiles?.avatar_url ?? null,
          created_at: item.created_at
        })),
        ...(guestData || []).map((item: any) => ({
          username: 'User',
          avatar_url: null,
          created_at: item.created_at
        }))
      ];
      formatted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const cache = interactionCacheRef.current;
      const keys = Object.keys(cache);
      if (keys.length >= INTERACTION_CACHE_MAX) {
        for (let i = 0; i <= keys.length - INTERACTION_CACHE_MAX; i++) {
          delete cache[keys[i]];
        }
      }
      cache[cacheKey] = formatted;

      setInteractionUsers(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setInteractionLoading(false);
    }
  }, [interactionModal.show, interactionModal.postId]);

  const onSheetTouchStart = useCallback((e: React.TouchEvent) => {
    // ตรวจสอบว่า touch เกิดขึ้นที่ scrollable area หรือไม่
    const target = e.target as HTMLElement;
    const scrollableArea = target.closest('[style*="overflowY"]') || target.closest('[style*="overflow-y"]');
    // ถ้า touch เกิดขึ้นใน scrollable area ไม่ให้ track เพื่อป้องกันการขยาย bottom sheet ตอน scroll
    if (scrollableArea && scrollableArea !== e.currentTarget) {
      return;
    }
    setStartY(e.touches[0].clientY);
  }, []);

  const onSheetTouchMove = useCallback((e: React.TouchEvent) => {
    // ตรวจสอบว่า touch เกิดขึ้นที่ scrollable area หรือไม่
    const target = e.target as HTMLElement;
    const scrollableArea = target.closest('[style*="overflowY"]') || target.closest('[style*="overflow-y"]');
    // ถ้า touch เกิดขึ้นใน scrollable area ไม่ให้ track เพื่อป้องกันการขยาย bottom sheet ตอน scroll
    if (scrollableArea && scrollableArea !== e.currentTarget) {
      return;
    }
    const moveY = e.touches[0].clientY - startY;
    setCurrentY(moveY);
  }, [startY]);

  const onSheetTouchEnd = useCallback(() => {
    // ป้องกันไม่ให้ bottom sheet ขยายใหญ่ขึ้นเมื่อ scroll ดูรายชื่อ
    // ให้ขยายได้เฉพาะเมื่อ drag ที่ header หรือ drag handle เท่านั้น
    // ไม่ให้ขยายใหญ่ขึ้น - ปิดได้เฉพาะเมื่อลากลง
    if (currentY > 50) {
      if (interactionSheetMode === 'full') {
        setInteractionSheetMode('half');
      } else {
        setIsInteractionModalAnimating(true);
        setTimeout(() => {
          setInteractionSheetMode('hidden');
          setInteractionModal({ ...interactionModal, show: false });
          setIsInteractionModalAnimating(false);
        }, 300);
      }
    }
    setCurrentY(0);
  }, [currentY, interactionSheetMode, interactionModal]);

  const closeModal = useCallback(() => {
    setIsInteractionModalAnimating(true);
    setTimeout(() => {
      setInteractionSheetMode('hidden');
      setInteractionModal({ ...interactionModal, show: false });
      setIsInteractionModalAnimating(false);
    }, 300);
  }, [interactionModal]);

  return {
    // State
    interactionModal,
    interactionUsers,
    isInteractionModalAnimating,
    interactionLoading,
    interactionSheetMode,
    startY,
    currentY,
    
    // Setters
    setInteractionModal,
    setStartY,
    setCurrentY,
    
    // Handlers
    fetchInteractions,
    onSheetTouchStart,
    onSheetTouchMove,
    onSheetTouchEnd,
    closeModal,
  };
}
