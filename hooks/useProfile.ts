'use client'

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isProviderDefaultAvatar } from '@/utils/avatarUtils';

interface Profile {
  username: string;
  avatar_url: string | null;
  phone?: string | null;
  last_seen?: string | null;
}

interface UseProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * useProfile Hook
 * Fetches and manages user profile data
 * Auto-fetches from session if available
 */
export function useProfile(userId?: string): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async (targetUserId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // If userId is provided, use it; otherwise get from session
      let uid = targetUserId;
      
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setProfile(null);
          setLoading(false);
          return;
        }
        uid = session.user.id;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('username, avatar_url, phone, last_seen')
        .eq('id', uid)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        let avatarUrl: string | null = data.avatar_url || null;
        // ถ้าเป็นรูป default จาก OAuth ให้ลบออกจาก DB เพื่อใช้รูป default ของระบบ
        if (avatarUrl && isProviderDefaultAvatar(avatarUrl)) {
          await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
          avatarUrl = null;
        }
        setProfile({
          username: data.username || 'User',
          avatar_url: avatarUrl,
          phone: data.phone || null,
          last_seen: data.last_seen || null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(userId);
  }, [userId, fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: () => fetchProfile(userId),
  };
}
