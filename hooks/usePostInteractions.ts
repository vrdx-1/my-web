import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { emitSavePostSuccessPopup, emitUnsavePostSuccessPopup } from '@/utils/savePostSuccessPopup';

type SessionLike = {
  user: {
    id: string;
  };
} | null;

type PostLike = {
  id: string;
  saves?: number;
};

interface UsePostInteractionsProps {
  session: SessionLike;
  activeProfileId?: string | null;
  posts: PostLike[];
  setPosts: React.Dispatch<React.SetStateAction<PostLike[]>>;
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
  activeProfileId,
  posts: _posts,
  setPosts: _setPosts,
  savedPosts,
  setSavedPosts,
  setJustSavedPosts,
  onExistingSaveRefresh,
  onRemoveSaveSuccess,
}: UsePostInteractionsProps) => {
  void _posts;
  void _setPosts;

  const toggleSave = useCallback(async (postId: string) => {
    const isUser = !!session;
    const userId = isUser ? (activeProfileId || session.user.id) : getPrimaryGuestToken();
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';
    const isCurrentlySaved = savedPosts[postId];

    // Optimistic update: save action is idempotent; re-saving keeps the post saved.
    setSavedPosts(prev => ({ ...prev, [postId]: true }));

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
          emitSavePostSuccessPopup();
        } else {
          // Rollback on error
          setSavedPosts(prev => ({ ...prev, [postId]: false }));
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
        }
      } else if (checkError) {
        // ถ้ามี error ในการตรวจสอบ ให้ rollback
        setSavedPosts(prev => ({ ...prev, [postId]: false }));
      }
    }
  }, [activeProfileId, session, savedPosts, setSavedPosts, setJustSavedPosts, onExistingSaveRefresh]);

  const removeSave = useCallback(async (postId: string) => {
    const isUser = !!session;
    const userId = isUser ? (activeProfileId || session.user.id) : getPrimaryGuestToken();
    const table = isUser ? 'post_saves' : 'post_saves_guest';
    const column = isUser ? 'user_id' : 'guest_token';

    setSavedPosts(prev => ({ ...prev, [postId]: false }));

    const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
    if (!error) {
      onRemoveSaveSuccess?.(postId);
      emitUnsavePostSuccessPopup();
    } else {
      setSavedPosts(prev => ({ ...prev, [postId]: true }));
    }
  }, [activeProfileId, session, setSavedPosts, onRemoveSaveSuccess]);

  return {
    toggleSave,
    removeSave,
  };
};
