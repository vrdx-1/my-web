import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { emitSavePostSuccessPopup, emitUnsavePostSuccessPopup } from '@/utils/savePostSuccessPopup';

interface UsePostInteractionsProps {
  session: any;
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  savedPosts: { [key: string]: boolean };
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setJustSavedPosts?: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onExistingSaveRefresh?: (postId: string) => void;
  onRemoveSaveSuccess?: (postId: string) => void;
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
  onExistingSaveRefresh,
  onRemoveSaveSuccess,
}: UsePostInteractionsProps) => {
  const toggleSave = useCallback(async (postId: string) => {
    const isUser = !!session;
    const userId = isUser ? session.user.id : getPrimaryGuestToken();
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const isCurrentlySaved = savedPosts[postId];
    const currentPost = posts.find(p => p.id === postId);
    const nextSavesCount = isCurrentlySaved ? (currentPost?.saves || 0) : (currentPost?.saves || 0) + 1;

    // Optimistic update: save action is idempotent; re-saving keeps the post saved.
    setSavedPosts(prev => ({ ...prev, [postId]: true }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: nextSavesCount } : p));

    // Animation for just saved
    if (setJustSavedPosts) {
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
      const refreshedAt = new Date().toISOString();
      const { error } = await supabase
        .from(table)
        .update({ created_at: refreshedAt })
        .eq(column, userId)
        .eq('post_id', postId);

      if (!error) {
        onExistingSaveRefresh?.(postId);
        emitSavePostSuccessPopup();
      } else {
        // Rollback on error
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: currentPost?.saves || 0 } : p));
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
          emitSavePostSuccessPopup();
        } else {
          // Rollback on error
          setSavedPosts(prev => ({ ...prev, [postId]: false }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
        }
      } else if (existing) {
        const refreshedAt = new Date().toISOString();
        const { error } = await supabase
          .from(table)
          .update({ created_at: refreshedAt })
          .eq(column, userId)
          .eq('post_id', postId);

        if (!error) {
          setSavedPosts(prev => ({ ...prev, [postId]: true }));
          onExistingSaveRefresh?.(postId);
          emitSavePostSuccessPopup();
        } else {
          setSavedPosts(prev => ({ ...prev, [postId]: false }));
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: currentPost?.saves || 0 } : p));
        }
      } else if (checkError) {
        // ถ้ามี error ในการตรวจสอบ ให้ rollback
        setSavedPosts(prev => ({ ...prev, [postId]: false }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
      }
    }
  }, [session, posts, savedPosts, setSavedPosts, setPosts, setJustSavedPosts, onExistingSaveRefresh]);

  const removeSave = useCallback(async (postId: string) => {
    const isUser = !!session;
    const userId = isUser ? session.user.id : getPrimaryGuestToken();
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const currentPost = posts.find(p => p.id === postId);
    const previousSaves = currentPost?.saves || 0;

    setSavedPosts(prev => ({ ...prev, [postId]: false }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: Math.max(0, (p.saves || 0) - 1) } : p));

    const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
    if (!error) {
      onRemoveSaveSuccess?.(postId);
      emitUnsavePostSuccessPopup();
    } else {
      setSavedPosts(prev => ({ ...prev, [postId]: true }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: previousSaves } : p));
    }
  }, [session, posts, setSavedPosts, setPosts, onRemoveSaveSuccess]);

  return {
    toggleSave,
    removeSave,
  };
};
