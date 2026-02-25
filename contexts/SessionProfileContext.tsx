'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SessionProfileValue {
  session: any;
  userProfile: { id?: string; username?: string | null; avatar_url?: string | null; phone?: string | null; last_seen?: string | null } | null;
}

const SessionProfileContext = createContext<SessionProfileValue | null>(null);

/**
 * แหล่งเดียวสำหรับ session + profile — fetch ครั้งเดียว แล้ว Header, BottomNav ฯลฯ อ่านจาก context
 * ทำให้รูปโปรไฟล์ใน Bottom Nav แสดงได้แน่นอนเมื่อ login
 */
export function SessionProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<SessionProfileValue['userProfile']>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfileIfMatch = useCallback((userId: string) => {
    currentUserIdRef.current = userId;
    supabase
      .from('profiles')
      .select('id, username, avatar_url, phone, last_seen')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[SessionProfileContext] profile fetch error:', error.message, error.code);
          }
          setUserProfile(null);
          return;
        }
        const currentId = currentUserIdRef.current;
        if (data && currentId != null && String(currentId) === String(data.id)) {
          setUserProfile(data);
        } else {
          setUserProfile(null);
        }
      });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        currentUserIdRef.current = s.user.id;
        fetchProfileIfMatch(s.user.id);
      } else {
        currentUserIdRef.current = null;
        setUserProfile(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        currentUserIdRef.current = s.user.id;
        fetchProfileIfMatch(s.user.id);
      } else {
        currentUserIdRef.current = null;
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileIfMatch]);

  const value: SessionProfileValue = { session, userProfile };

  return (
    <SessionProfileContext.Provider value={value}>
      {children}
    </SessionProfileContext.Provider>
  );
}

export function useSessionProfileContext() {
  return useContext(SessionProfileContext);
}
