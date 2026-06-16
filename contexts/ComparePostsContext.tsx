'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { safeParseJSON } from '@/utils/storageUtils';

const COMPARE_POST_IDS_STORAGE_KEY = 'compare_post_ids_v1';
const COMPARE_SEEN_POST_IDS_STORAGE_KEY = 'compare_seen_post_ids_v1';
const MAX_COMPARE_POSTS = 50;

type ComparePostsContextValue = {
  postIds: string[];
  count: number;
  unreadCount: number;
  loaded: boolean;
  isSyncing: boolean;
  addPost: (postId: string) => Promise<void>;
  removePost: (postId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  markAllViewed: () => Promise<void>;
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

function mergeUniquePostIds(...lists: string[][]): string[] {
  return normalizePostIds(lists.flat());
}

function sanitizeSeenPostIds(seenPostIds: string[], postIds: string[]): string[] {
  const postIdSet = new Set(postIds);
  return normalizePostIds(seenPostIds).filter((postId) => postIdSet.has(postId));
}

export function ComparePostsProvider({ children }: { children: React.ReactNode }) {
  const { session, sessionReady, activeProfileId, authUserId } = useSessionAndProfile();
  const [postIds, setPostIds] = React.useState<string[]>([]);
  const [seenPostIds, setSeenPostIds] = React.useState<string[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const actorId = activeProfileId || authUserId || session?.user?.id || null;

  const readLocalPostIds = React.useCallback(() => {
    return normalizePostIds(safeParseJSON<string[]>(COMPARE_POST_IDS_STORAGE_KEY, []));
  }, []);

  const readLocalSeenPostIds = React.useCallback(() => {
    return normalizePostIds(safeParseJSON<string[]>(COMPARE_SEEN_POST_IDS_STORAGE_KEY, []));
  }, []);

  const writeLocalPostIds = React.useCallback((nextPostIds: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(COMPARE_POST_IDS_STORAGE_KEY, JSON.stringify(normalizePostIds(nextPostIds)));
    } catch {
      // ignore local storage persistence failure
    }
  }, []);

  const writeLocalSeenPostIds = React.useCallback((nextSeenPostIds: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(COMPARE_SEEN_POST_IDS_STORAGE_KEY, JSON.stringify(normalizePostIds(nextSeenPostIds)));
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
    const localSeenPostIds = readLocalSeenPostIds();

    setIsSyncing(true);
    try {
      if (!actorId) {
        if (requestIdRef.current !== currentRequestId) return;
        setPostIds(localPostIds);
        const nextSeenPostIds = sanitizeSeenPostIds(localSeenPostIds, localPostIds);
        setSeenPostIds(nextSeenPostIds);
        writeLocalSeenPostIds(nextSeenPostIds);
        return;
      }

      const [{ data, error }, viewResult] = await Promise.all([
        supabase
        .from('post_compare_lists')
        .select('post_id, created_at')
        .eq('user_id', actorId)
        .order('created_at', { ascending: false }),
        supabase
          .from('post_compare_list_views')
          .select('last_viewed_at')
          .eq('user_id', actorId)
          .maybeSingle(),
      ]);

      if (requestIdRef.current !== currentRequestId) return;

      if (error) {
        setPostIds(localPostIds);
        const nextSeenPostIds = sanitizeSeenPostIds(localSeenPostIds, localPostIds);
        setSeenPostIds(nextSeenPostIds);
        writeLocalSeenPostIds(nextSeenPostIds);
        return;
      }

      const serverRows = data || [];
      const nextPostIds = mergeUniquePostIds(
        localPostIds,
        serverRows.map((row) => String(row.post_id)),
      );

      const lastViewedAtRaw = viewResult.data?.last_viewed_at;
      const lastViewedAt = typeof lastViewedAtRaw === 'string' ? Date.parse(lastViewedAtRaw) : NaN;
      const hasLastViewedAt = Number.isFinite(lastViewedAt);
      const serverSeenPostIds = hasLastViewedAt
        ? serverRows
          .filter((row) => {
            const createdAt = Date.parse(String(row.created_at ?? ''));
            return Number.isFinite(createdAt) && createdAt <= lastViewedAt;
          })
          .map((row) => String(row.post_id))
        : [];

      const nextSeenPostIds = sanitizeSeenPostIds(
        mergeUniquePostIds(localSeenPostIds, serverSeenPostIds),
        nextPostIds,
      );

      setPostIds(nextPostIds);
      setSeenPostIds(nextSeenPostIds);
      writeLocalSeenPostIds(nextSeenPostIds);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setLoaded(true);
        setIsSyncing(false);
      }
    }
  }, [actorId, readLocalPostIds, readLocalSeenPostIds, sessionReady, writeLocalSeenPostIds]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPost = React.useCallback(async (postId: string) => {
    const trimmed = postId.trim();
    if (!trimmed) return;

    const alreadyCompared = postIds.includes(trimmed);
    const nextPostIds = movePostIdToFront(postIds, trimmed);
    writeLocalPostIds(nextPostIds);
    setPostIds(nextPostIds);

    if (!alreadyCompared) {
      const nextSeenPostIds = removePostId(seenPostIds, trimmed);
      writeLocalSeenPostIds(nextSeenPostIds);
      setSeenPostIds(nextSeenPostIds);
    }

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
  }, [actorId, postIds, seenPostIds, writeLocalPostIds, writeLocalSeenPostIds]);

  const removePost = React.useCallback(async (postId: string) => {
    const trimmed = postId.trim();
    if (!trimmed) return;

    const nextPostIds = removePostId(postIds, trimmed);
    const nextSeenPostIds = removePostId(seenPostIds, trimmed);
    writeLocalPostIds(nextPostIds);
    writeLocalSeenPostIds(nextSeenPostIds);
    setPostIds(nextPostIds);
    setSeenPostIds(nextSeenPostIds);

    if (!actorId) return;

    const { error } = await supabase
      .from('post_compare_lists')
      .delete()
      .eq('user_id', actorId)
      .eq('post_id', trimmed);

    if (error) {
      return;
    }
  }, [actorId, postIds, seenPostIds, writeLocalPostIds, writeLocalSeenPostIds]);

  const clearAll = React.useCallback(async () => {
    setPostIds([]);
    setSeenPostIds([]);
    writeLocalPostIds([]);
    writeLocalSeenPostIds([]);

    if (!actorId) return;

    const { error } = await supabase
      .from('post_compare_lists')
      .delete()
      .eq('user_id', actorId);

    if (error) {
      return;
    }
  }, [actorId, writeLocalPostIds, writeLocalSeenPostIds]);

  const markAllViewed = React.useCallback(async () => {
    const nextSeenPostIds = normalizePostIds(postIds);
    setSeenPostIds(nextSeenPostIds);
    writeLocalSeenPostIds(nextSeenPostIds);

    if (!actorId) return;

    await supabase
      .from('post_compare_list_views')
      .upsert(
        [{ user_id: actorId, last_viewed_at: new Date().toISOString() }],
        { onConflict: 'user_id' },
      );
  }, [actorId, postIds, writeLocalSeenPostIds]);

  const comparedPostIds = React.useMemo(() => new Set(postIds), [postIds]);
  const seenPostIdSet = React.useMemo(() => new Set(seenPostIds), [seenPostIds]);
  const unreadCount = React.useMemo(() => {
    let next = 0;
    for (const postId of postIds) {
      if (!seenPostIdSet.has(postId)) next += 1;
    }
    return next;
  }, [postIds, seenPostIdSet]);

  const value = React.useMemo<ComparePostsContextValue>(() => ({
    postIds,
    count: postIds.length,
    unreadCount,
    loaded,
    isSyncing,
    addPost,
    removePost,
    clearAll,
    markAllViewed,
    isCompared: (postId: string) => comparedPostIds.has(postId),
    refresh,
  }), [addPost, clearAll, comparedPostIds, isSyncing, loaded, markAllViewed, postIds, refresh, removePost, unreadCount]);

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