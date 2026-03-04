'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SessionProfileValue {
  session: any;
  sessionReady: boolean;
  userProfile: { id?: string; username?: string | null; avatar_url?: string | null; phone?: string | null; last_seen?: string | null } | null;
  /** เรียกเมื่อโหลดโพสต์ชุดแรกเสร็จแล้ว — ระบบจะเริ่มตรวจว่าใครอยู่ */
  startSessionCheck: () => void;
}

const SessionProfileContext = createContext<SessionProfileValue | null>(null);

/**
 * แหล่งเดียวสำหรับ session + profile — fetch ครั้งเดียว แล้ว Header, BottomNav ฯลฯ อ่านจาก context
 * ทำให้รูปโปรไฟล์ใน Bottom Nav แสดงได้แน่นอนเมื่อ login
 */
export function SessionProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [userProfile, setUserProfile] = useState<SessionProfileValue['userProfile']>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const sessionCheckStartedRef = useRef(false);

  const startSessionCheck = useCallback(() => {
    if (sessionCheckStartedRef.current) return;
    sessionCheckStartedRef.current = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionReady(true);
      if (s?.user?.id) {
        currentUserIdRef.current = s.user.id;
        fetchProfileIfMatch(s.user.id);
      } else {
        currentUserIdRef.current = null;
        setUserProfile(null);
      }
    });
  }, []);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!sessionCheckStartedRef.current) return;
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

  // ถ้าไม่ใช่หน้าโฮม (ไม่มีฟีดโหลด) ให้เริ่มตรวจ session หลังดีเลย์
  useEffect(() => {
    const t = window.setTimeout(() => startSessionCheck(), 3000);
    return () => clearTimeout(t);
  }, [startSessionCheck]);

  const value: SessionProfileValue = { session, sessionReady, userProfile, startSessionCheck };

  return (
    <SessionProfileContext.Provider value={value}>
      {children}
    </SessionProfileContext.Provider>
  );
}

export function useSessionProfileContext() {
  return useContext(SessionProfileContext);
}
