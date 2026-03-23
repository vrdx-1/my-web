import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

interface UsePostInteractionsProps {
  session: any;
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  savedPosts: { [key: string]: boolean };
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setJustSavedPosts?: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

/**
 * Custom hook for managing post interactions (like, save)
 * Optimized with useCallback for better performance
 */
export const usePostInteractions = ({
  session,
  posts,
  setPosts,
  savedPosts,
  setSavedPosts,
  setJustSavedPosts,
}: UsePostInteractionsProps) => {
  const toggleSave = useCallback(async (postId: string) => {
    const isUser = !!session;
    const userId = isUser ? session.user.id : getPrimaryGuestToken();
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const isCurrentlySaved = savedPosts[postId];
    const currentPost = posts.find(p => p.id === postId);
    const newSavesCount = isCurrentlySaved ? (currentPost?.saves || 1) - 1 : (currentPost?.saves || 0) + 1;

    // Optimistic update
    setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: newSavesCount } : p));

    // Animation for just saved
    if (!isCurrentlySaved && setJustSavedPosts) {
      setJustSavedPosts(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => {
        if (setJustSavedPosts) {
          setJustSavedPosts(prev => {
            const newState = { ...prev };
            delete newState[postId];
            return newState;
          });
        }
      }, 300);
    }

    // Update database
    if (isCurrentlySaved) {
      const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
      if (!error) {
        // cars.saves อัปเดตโดย trigger ใน DB
      } else {
        // Rollback on error
        setSavedPosts(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p));
      }
    } else {
      // ตรวจสอบว่ามี record อยู่แล้วหรือไม่ก่อน insert
      const { data: existing, error: checkError } = await supabase
        .from(table)
        .select('post_id')
        .eq(column, userId)
        .eq('post_id', postId)
        .maybeSingle();
      
      // ถ้าไม่มี error และไม่มี existing record ให้ insert
      if (!checkError && !existing) {
        const { error } = await supabase.from(table).insert([{ [column]: userId, post_id: postId }]);
        if (!error) {
          // cars.saves อัปเดตโดย trigger ใน DB
        } else {
          // Rollback on error
          setSavedPosts(prev => ({ ...prev, [postId]: false }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
        }
      } else if (existing) {
        // Record มีอยู่แล้ว - update state ให้ถูกต้อง
        setSavedPosts(prev => ({ ...prev, [postId]: true }));
      } else if (checkError) {
        // ถ้ามี error ในการตรวจสอบ ให้ rollback
        setSavedPosts(prev => ({ ...prev, [postId]: false }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
      }
    }
  }, [session, posts, savedPosts, setSavedPosts, setPosts, setJustSavedPosts]);

  return {
    toggleSave,
  };
};
