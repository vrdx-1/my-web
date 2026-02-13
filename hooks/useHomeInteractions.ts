'use client'

import { useCallback } from 'react';

/**
 * Custom hook สำหรับจัดการ interaction handlers ในหน้า Home
 * รวม handleViewLikes และ handleViewSaves เพื่อลดความซับซ้อน
 */
export function useHomeInteractions({
  interactionModalHook,
  posts,
}: {
  interactionModalHook: {
    fetchInteractions: (type: 'likes' | 'saves', postId: string, posts: any[]) => Promise<void>;
  };
  posts: any[];
}) {
  const fetchInteractions = useCallback(async (type: 'likes' | 'saves', postId: string) => {
    await interactionModalHook.fetchInteractions(type, postId, posts);
  }, [interactionModalHook, posts]);

  const handleViewLikes = useCallback((postId: string) => {
    fetchInteractions('likes', postId);
  }, [fetchInteractions]);

  const handleViewSaves = useCallback((postId: string) => {
    fetchInteractions('saves', postId);
  }, [fetchInteractions]);

  return {
    handleViewLikes,
    handleViewSaves,
    fetchInteractions,
  };
}
