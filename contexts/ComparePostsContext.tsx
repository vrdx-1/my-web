'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { safeParseJSON } from '@/utils/storageUtils';

const COMPARE_POST_IDS_STORAGE_KEY = 'compare_post_ids_v1';
const MAX_COMPARE_POSTS = 50;

type ComparePostsContextValue = {
  postIds: string[];
  count: number;
  loaded: boolean;
  isSyncing: boolean;
  addPost: (postId: string) => Promise<void>;
  removePost: (postId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  isCompared: (postId: string) => boolean;
  refresh: () => Promise<void>;
};

const ComparePostsContext = React.createContext<ComparePostsContextValue | null>(null);

function normalizePostIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const next: string[] = [];
  const seen = new Set<string>();

  for (const value of input) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
    if (next.length >= MAX_COMPARE_POSTS) break;
  }

  return next;
}

function movePostIdToFront(postIds: string[], postId: string): string[] {
  const trimmed = postId.trim();
  if (!trimmed) return postIds;
  return [trimmed, ...postIds.filter((value) => value !== trimmed)].slice(0, MAX_COMPARE_POSTS);
}

function removePostId(postIds: string[], postId: string): string[] {
  const trimmed = postId.trim();
  if (!trimmed) return postIds;
  return postIds.filter((value) => value !== trimmed);
}

export function ComparePostsProvider({ children }: { children: React.ReactNode }) {
  const { session, sessionReady, activeProfileId, authUserId } = useSessionAndProfile();
  const [postIds, setPostIds] = React.useState<string[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const actorId = activeProfileId || authUserId || session?.user?.id || null;

  const readLocalPostIds = React.useCallback(() => {
    return normalizePostIds(safeParseJSON<string[]>(COMPARE_POST_IDS_STORAGE_KEY, []));
  }, []);

  const writeLocalPostIds = React.useCallback((nextPostIds: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(COMPARE_POST_IDS_STORAGE_KEY, JSON.stringify(normalizePostIds(nextPostIds)));
    } catch {
      // ignore local storage persistence failure
    }
  }, []);

  const refresh = React.useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    if (!sessionReady) {
      setLoaded(false);
      return;
    }

    const localPostIds = readLocalPostIds();

    setIsSyncing(true);
    try {
      if (!actorId) {
        if (requestIdRef.current !== currentRequestId) return;
        setPostIds(localPostIds);
        return;
      }

      const { data, error } = await supabase
        .from('post_compare_lists')
        .select('post_id')
        .eq('user_id', actorId)
        .order('created_at', { ascending: false });

      if (requestIdRef.current !== currentRequestId) return;

      if (error) {
        setPostIds(localPostIds);
        return;
      }

      const nextPostIds = normalizePostIds([
        ...localPostIds,
        ...(data || []).map((row) => row.post_id),
      ]);
      setPostIds(nextPostIds);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setLoaded(true);
        setIsSyncing(false);
      }
    }
  }, [actorId, readLocalPostIds, sessionReady]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPost = React.useCallback(async (postId: string) => {
    const trimmed = postId.trim();
    if (!trimmed) return;

    const nextPostIds = movePostIdToFront(postIds, trimmed);
    writeLocalPostIds(nextPostIds);
    setPostIds(nextPostIds);

    if (!actorId) return;

    const { error } = await supabase
      .from('post_compare_lists')
      .upsert(
        [{ user_id: actorId, post_id: trimmed, created_at: new Date().toISOString() }],
        { onConflict: 'user_id,post_id' },
      );

    if (error) {
      return;
    }
  }, [actorId, postIds, writeLocalPostIds]);

  const removePost = React.useCallback(async (postId: string) => {
    const trimmed = postId.trim();
    if (!trimmed) return;

    const nextPostIds = removePostId(postIds, trimmed);
    writeLocalPostIds(nextPostIds);
    setPostIds(nextPostIds);

    if (!actorId) return;

    const { error } = await supabase
      .from('post_compare_lists')
      .delete()
      .eq('user_id', actorId)
      .eq('post_id', trimmed);

    if (error) {
      return;
    }
  }, [actorId, postIds, writeLocalPostIds]);

  const clearAll = React.useCallback(async () => {
    setPostIds([]);
    writeLocalPostIds([]);

    if (!actorId) return;

    const { error } = await supabase
      .from('post_compare_lists')
      .delete()
      .eq('user_id', actorId);

    if (error) {
      return;
    }
  }, [actorId, refresh, writeLocalPostIds]);

  const comparedPostIds = React.useMemo(() => new Set(postIds), [postIds]);

  const value = React.useMemo<ComparePostsContextValue>(() => ({
    postIds,
    count: postIds.length,
    loaded,
    isSyncing,
    addPost,
    removePost,
    clearAll,
    isCompared: (postId: string) => comparedPostIds.has(postId),
    refresh,
  }), [addPost, clearAll, comparedPostIds, isSyncing, loaded, postIds, refresh, removePost]);

  return (
    <ComparePostsContext.Provider value={value}>
      {children}
    </ComparePostsContext.Provider>
  );
}

export function useComparePosts() {
  const context = React.useContext(ComparePostsContext);
  if (!context) {
    throw new Error('useComparePosts must be used within ComparePostsProvider');
  }
  return context;
}