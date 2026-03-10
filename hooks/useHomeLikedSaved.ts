'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

export interface HomeLikedSaved {
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

/** โหลด liked/saved ครั้งเดียวสำหรับหน้าโฮม — แชร์ให้ useHomeFeed, useSearchPosts, usePostListData(sold) ใช้ร่วมกัน ลด request ซ้ำ 3 ชุด */
export function useHomeLikedSaved(session: any, sessionReady: boolean): HomeLikedSaved {
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!sessionReady) return;
    const currentSession = session ?? undefined;
    if (currentSession === undefined) return;
    let idOrToken: string | null = null;
    if (currentSession?.user?.id) {
      const uid = currentSession.user.id;
      if (typeof uid === 'string' && uid !== 'null' && /^[0-9a-f-]{36}$/i.test(uid)) {
        idOrToken = uid;
      }
    }
    if (!idOrToken && typeof window !== 'undefined') {
      try {
        const token = getPrimaryGuestToken();
        if (token && typeof token === 'string' && token !== 'null') idOrToken = token;
      } catch (_) {}
    }
    if (!idOrToken) return;
    const isUser = !!currentSession?.user?.id;
    const likesTable = isUser ? 'post_likes' : 'post_likes_guest';
    const likesColumn = isUser ? 'user_id' : 'guest_token';
    const savesTable = isUser ? 'post_saves' : 'post_saves_guest';
    const savesColumn = isUser ? 'user_id' : 'guest_token';
    Promise.all([
      supabase.from(likesTable).select('post_id').eq(likesColumn, idOrToken),
      supabase.from(savesTable).select('post_id').eq(savesColumn, idOrToken),
    ]).then(([likedRes, savedRes]) => {
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
  }, [sessionReady, session]);

  return { likedPosts, savedPosts, setLikedPosts, setSavedPosts };
}
