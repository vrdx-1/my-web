'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const ACTIVE_PROFILE_STORAGE_KEY_PREFIX = 'active_profile_';

export interface SessionProfileRecord {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  role?: string | null;
  is_sub_account?: boolean | null;
  parent_admin_id?: string | null;
}

export interface SessionProfileValue {
  session: Session | null;
  sessionReady: boolean;
  userProfile: SessionProfileRecord | null;
  activeProfileId: string | null;
  authUserId: string | null;
  availableProfiles: SessionProfileRecord[];
  setActiveProfile: (profileId: string | null) => void;
  activateProfileRecord: (profile: SessionProfileRecord) => void;
  refetchProfiles: () => Promise<void>;
  /** เรียกเมื่อโหลดโพสต์ชุดแรกเสร็จแล้ว */
  startSessionCheck: () => void;
}

const SessionProfileContext = createContext<SessionProfileValue | null>(null);

/**
 * แหล่งเดียวสำหรับ session + profile — fetch ครั้งเดียว แล้ว Header, BottomNav ฯลฯ อ่านจาก context
 * ทำให้รูปโปรไฟล์ใน Bottom Nav แสดงได้แน่นอนเมื่อ login
 */
export function SessionProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [userProfile, setUserProfile] = useState<SessionProfileValue['userProfile']>(null);
  const [availableProfiles, setAvailableProfiles] = useState<SessionProfileRecord[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const sessionCheckStartedRef = useRef(false);
  const deferredProfileFetchTimerRef = useRef<number | null>(null);

  const getStoredActiveProfileId = useCallback((userId: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY_PREFIX + userId);
    } catch {
      return null;
    }
  }, []);

  const persistActiveProfileId = useCallback((userId: string, profileId: string | null) => {
    if (typeof window === 'undefined') return;
    try {
      const key = ACTIVE_PROFILE_STORAGE_KEY_PREFIX + userId;
      if (profileId) {
        window.localStorage.setItem(key, profileId);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

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

  const applyProfiles = useCallback((userId: string, profiles: SessionProfileRecord[]) => {
    setAvailableProfiles(profiles);
    const storedActiveId = getStoredActiveProfileId(userId);
    const fallbackProfile = profiles.find((profile) => profile.id === userId) ?? profiles[0] ?? null;
    const resolvedActive = profiles.find((profile) => profile.id === storedActiveId) ?? fallbackProfile;
    const nextActiveId = resolvedActive?.id ?? null;

    setActiveProfileId(nextActiveId);
    setUserProfile(resolvedActive ?? null);
    persistActiveProfileId(userId, nextActiveId);
  }, [getStoredActiveProfileId, persistActiveProfileId]);

  const fetchProfileIfMatch = useCallback(async function fetchProfileIfMatchInternal(userId: string, retryCount = 0) {
    currentUserIdRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, phone, role, is_sub_account, parent_admin_id')
        .or(`id.eq.${userId},parent_admin_id.eq.${userId}`);

      if (error) {
        if (isTransientFetchError(error) && retryCount < 2 && typeof window !== 'undefined') {
          window.setTimeout(() => {
            void fetchProfileIfMatchInternal(userId, retryCount + 1);
          }, 800 * (retryCount + 1));
          return;
        }

        if (process.env.NODE_ENV === 'development' && !isTransientFetchError(error)) {
          console.error('[SessionProfileContext] profile fetch error:', error.message, error.code);
        }
        setUserProfile(null);
        setAvailableProfiles([]);
        setActiveProfileId(null);
        return;
      }

      const currentId = currentUserIdRef.current;
      if (Array.isArray(data) && currentId != null && String(currentId) === String(userId)) {
        applyProfiles(userId, data);
      } else {
        setUserProfile(null);
        setAvailableProfiles([]);
        setActiveProfileId(null);
      }
    } catch (error) {
      if (isTransientFetchError(error) && retryCount < 2 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          void fetchProfileIfMatchInternal(userId, retryCount + 1);
        }, 800 * (retryCount + 1));
        return;
      }

      if (process.env.NODE_ENV === 'development' && !isTransientFetchError(error)) {
        console.error('[SessionProfileContext] unexpected profile fetch error:', error);
      }
      setUserProfile(null);
      setAvailableProfiles([]);
      setActiveProfileId(null);
    }
  }, [applyProfiles, isTransientFetchError]);

  const refetchProfiles = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (!userId) return;
    await fetchProfileIfMatch(userId);
  }, [fetchProfileIfMatch]);

  const setActiveProfile = useCallback((profileId: string | null) => {
    const userId = currentUserIdRef.current;
    if (!userId) return;

    const fallbackProfile = availableProfiles.find((profile) => profile.id === userId) ?? availableProfiles[0] ?? null;
    const resolvedProfile = profileId
      ? availableProfiles.find((profile) => profile.id === profileId) ?? fallbackProfile
      : fallbackProfile;

    const nextActiveId = resolvedProfile?.id ?? null;
    setActiveProfileId(nextActiveId);
    setUserProfile(resolvedProfile ?? null);
    persistActiveProfileId(userId, nextActiveId);
  }, [availableProfiles, persistActiveProfileId]);

  const activateProfileRecord = useCallback((profile: SessionProfileRecord) => {
    const userId = currentUserIdRef.current;
    if (!userId || !profile?.id) return;

    const existingProfile = availableProfiles.find((item) => item.id === profile.id) ?? null;
    const nextProfile: SessionProfileRecord = {
      ...existingProfile,
      ...profile,
    };
    const nextProfiles = existingProfile
      ? availableProfiles.map((item) => (item.id === profile.id ? nextProfile : item))
      : [...availableProfiles, nextProfile];

    setAvailableProfiles(nextProfiles);
    setActiveProfileId(nextProfile.id);
    setUserProfile(nextProfile);
    persistActiveProfileId(userId, nextProfile.id);
  }, [availableProfiles, persistActiveProfileId]);

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
        setAvailableProfiles([]);
        setActiveProfileId(null);
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
        setAvailableProfiles([]);
        setActiveProfileId(null);
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

  const value: SessionProfileValue = {
    session,
    sessionReady,
    userProfile,
    activeProfileId,
    authUserId: currentUserIdRef.current,
    availableProfiles,
    setActiveProfile,
    activateProfileRecord,
    refetchProfiles,
    startSessionCheck,
  };

  return (
    <SessionProfileContext.Provider value={value}>
      {children}
    </SessionProfileContext.Provider>
  );
}

export function useSessionProfileContext() {
  return useContext(SessionProfileContext);
}
