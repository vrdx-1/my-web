'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Lightweight hook for session + profile only (e.g. header).
 * Does not fetch posts or feed data.
 */
export function useSessionAndProfile() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        supabase
          .from('profiles')
          .select('username, avatar_url, phone, last_seen')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => data && setUserProfile(data));
      } else {
        setUserProfile(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        supabase
          .from('profiles')
          .select('username, avatar_url, phone, last_seen')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => data && setUserProfile(data));
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, userProfile };
}
