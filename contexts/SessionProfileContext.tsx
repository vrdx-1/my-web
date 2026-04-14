'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SessionProfileValue {
  session: any;
  sessionReady: boolean;
  userProfile: { id?: string; username?: string | null; avatar_url?: string | null; phone?: string | null } | null;
  /** เรียกเมื่อโหลดโพสต์ชุดแรกเสร็จแล้ว */
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
  const deferredProfileFetchTimerRef = useRef<number | null>(null);

  const isTransientFetchError = useCallback((error: unknown) => {
    const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    const code = String((error as { code?: string } | null)?.code ?? '').toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed') ||
      code === 'aborterror'
    );
  }, []);

  const clearDeferredProfileFetch = useCallback(() => {
    if (deferredProfileFetchTimerRef.current != null) {
      window.clearTimeout(deferredProfileFetchTimerRef.current);
      deferredProfileFetchTimerRef.current = null;
    }
  }, []);

  const fetchProfileIfMatch = useCallback(async (userId: string, retryCount = 0) => {
    currentUserIdRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, phone')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (isTransientFetchError(error) && retryCount < 2 && typeof window !== 'undefined') {
          window.setTimeout(() => {
            void fetchProfileIfMatch(userId, retryCount + 1);
          }, 800 * (retryCount + 1));
          return;
        }

        if (process.env.NODE_ENV === 'development' && !isTransientFetchError(error)) {
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
    } catch (error) {
      if (isTransientFetchError(error) && retryCount < 2 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          void fetchProfileIfMatch(userId, retryCount + 1);
        }, 800 * (retryCount + 1));
        return;
      }

      if (process.env.NODE_ENV === 'development' && !isTransientFetchError(error)) {
        console.error('[SessionProfileContext] unexpected profile fetch error:', error);
      }
      setUserProfile(null);
    }
  }, [isTransientFetchError]);

  const startSessionCheck = useCallback(() => {
    if (sessionCheckStartedRef.current) return;
    sessionCheckStartedRef.current = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionReady(true);
      if (s?.user?.id) {
        currentUserIdRef.current = s.user.id;
        clearDeferredProfileFetch();
        const scheduleFetch = () => {
          deferredProfileFetchTimerRef.current = window.setTimeout(() => {
            deferredProfileFetchTimerRef.current = null;
            fetchProfileIfMatch(s.user.id);
          }, 1200);
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number })
            .requestIdleCallback?.(() => scheduleFetch(), { timeout: 1800 });
        } else {
          scheduleFetch();
        }
      } else {
        clearDeferredProfileFetch();
        currentUserIdRef.current = null;
        setUserProfile(null);
      }
    });
  }, [clearDeferredProfileFetch, fetchProfileIfMatch]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!sessionCheckStartedRef.current) return;
      setSession(s);
      if (s?.user?.id) {
        currentUserIdRef.current = s.user.id;
        clearDeferredProfileFetch();
        deferredProfileFetchTimerRef.current = window.setTimeout(() => {
          deferredProfileFetchTimerRef.current = null;
          fetchProfileIfMatch(s.user.id);
        }, 1200);
      } else {
        clearDeferredProfileFetch();
        currentUserIdRef.current = null;
        setUserProfile(null);
      }
    });
    return () => {
      clearDeferredProfileFetch();
      subscription.unsubscribe();
    };
  }, [clearDeferredProfileFetch, fetchProfileIfMatch]);

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
