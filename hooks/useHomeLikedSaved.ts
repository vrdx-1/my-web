'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

export interface HomeLikedSaved {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

/** โหลด liked/saved ครั้งเดียวสำหรับหน้าโฮม — แชร์ให้ useHomeFeed, useSearchPosts, usePostListData(sold) ใช้ร่วมกัน ลด request ซ้ำ 3 ชุด */
export function useHomeLikedSaved(session: Session | null, sessionReady: boolean, activeProfileId?: string | null): HomeLikedSaved {
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!sessionReady) return;
    const currentSession = session ?? undefined;
    if (currentSession === undefined) return;
    let idOrToken: string | null = null;
    if (currentSession?.user?.id) {
      const uid = activeProfileId || currentSession.user.id;
      if (typeof uid === 'string' && uid !== 'null' && /^[0-9a-f-]{36}$/i.test(uid)) {
        idOrToken = uid;
      }
    }
    if (!idOrToken && typeof window !== 'undefined') {
      try {
        const token = getPrimaryGuestToken();
        if (token && typeof token === 'string' && token !== 'null') idOrToken = token;
      } catch {}
    }
    if (!idOrToken) return;
    const isUser = !!currentSession?.user?.id;
    const likesTable = isUser ? 'post_likes' : 'post_likes_guest';
    const likesColumn = isUser ? 'user_id' : 'guest_token';
    const savesTable = isUser ? 'post_saves' : 'post_saves_guest';
    const savesColumn = isUser ? 'user_id' : 'guest_token';
    let cancelled = false;
    const runFetch = () => {
      Promise.all([
        supabase.from(likesTable).select('post_id').eq(likesColumn, idOrToken),
        supabase.from(savesTable).select('post_id').eq(savesColumn, idOrToken),
      ]).then(([likedRes, savedRes]) => {
        if (cancelled) return;
        if (likedRes.data) {
          const map: { [key: string]: boolean } = {};
          likedRes.data.forEach((item: { post_id: string }) => {
            map[item.post_id] = true;
          });
          setLikedPosts((prev) => ({ ...prev, ...map }));
        }
        if (savedRes.data) {
          const map: { [key: string]: boolean } = {};
          savedRes.data.forEach((item: { post_id: string }) => {
            map[item.post_id] = true;
          });
          setSavedPosts((prev) => ({ ...prev, ...map }));
        }
      });
    };

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const delayMs = path === '/home' ? 1200 : 250;
    const timerId = window.setTimeout(runFetch, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [activeProfileId, sessionReady, session]);

  return { likedPosts, savedPosts, setLikedPosts, setSavedPosts };
}
