'use client';

import { useMemo } from 'react';
import { useSearchFeedSlice } from '@/hooks/useSearchFeedSlice';
import type { useHomeFeed } from './useHomeFeed';
import type { useSearchPosts } from './useSearchPosts';

export interface HomePostListSource {
  posts: any[];
  setPosts: (fn: any) => void;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  setLikedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setSavedPosts: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  loadingMore: boolean;
  hasMore: boolean;
  setPage: (v: number | ((p: number) => number)) => void;
  fetchPosts: (isInitial?: boolean) => Promise<void>;
}

export const HOME_SOLD_STUB: HomePostListSource = {
  posts: [],
  setPosts: (_: any) => {},
  session: undefined,
  likedPosts: {},
  savedPosts: {},
  setLikedPosts: (_: any) => {},
  setSavedPosts: (_: any) => {},
  loadingMore: false,
  hasMore: false,
  setPage: (_: any) => {},
  fetchPosts: (_?: boolean) => Promise.resolve(),
};

export interface UseHomeSearchResultSourcesOptions {
  hasSearch: boolean;
  searchQuery: string;
  searchData: ReturnType<typeof useSearchPosts>;
  recommendFeed: ReturnType<typeof useHomeFeed>;
}

export function useHomeSearchResultSources(options: UseHomeSearchResultSourcesOptions) {
  const { hasSearch, searchQuery, searchData, recommendFeed } = options;

  const recommendFiltered = useMemo(
    () => (hasSearch ? searchData.posts.filter((p: any) => p.status === 'recommend') : []),
    [hasSearch, searchData.posts],
  );
  const soldFiltered = useMemo(
    () => (hasSearch ? searchData.posts.filter((p: any) => p.status === 'sold') : []),
    [hasSearch, searchData.posts],
  );

  const searchRecommendSlice = useSearchFeedSlice({
    enabled: hasSearch,
    allPosts: recommendFiltered,
    loading: searchData.loading,
    queryKey: `${searchQuery}|rec`,
  });
  const searchSoldSlice = useSearchFeedSlice({
    enabled: hasSearch,
    allPosts: soldFiltered,
    loading: searchData.loading,
    queryKey: `${searchQuery}|sold`,
  });

  const recommendSource: HomePostListSource = hasSearch
    ? {
        posts: searchRecommendSlice.displayPosts,
        setPosts: (fn: any) => {
          searchData.setPosts((prev: any[]) => {
            const recommendOnly = prev.filter((p: any) => p.status === 'recommend');
            const next = typeof fn === 'function' ? fn(recommendOnly) : fn;
            if (!Array.isArray(next)) return prev;
            const byId = new Map(next.map((p: any) => [p.id, p]));
            const nextIds = new Set(next.map((p: any) => p.id));
            return prev
              .filter((p: any) => p.status !== 'recommend' || nextIds.has(p.id))
              .map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
          });
        },
        session: searchData.session,
        likedPosts: searchData.likedPosts,
        savedPosts: searchData.savedPosts,
        setLikedPosts: searchData.setLikedPosts,
        setSavedPosts: searchData.setSavedPosts,
        loadingMore: searchRecommendSlice.loadingMore,
        hasMore: searchRecommendSlice.hasMore,
        setPage: searchRecommendSlice.setPage,
        fetchPosts: () => searchData.fetchSearch(),
      }
    : recommendFeed;

  const soldSource: HomePostListSource = hasSearch
    ? {
        posts: searchSoldSlice.displayPosts,
        setPosts: (fn: any) => {
          searchData.setPosts((prev: any[]) => {
            const soldOnly = prev.filter((p: any) => p.status === 'sold');
            const next = typeof fn === 'function' ? fn(soldOnly) : fn;
            if (!Array.isArray(next)) return prev;
            const byId = new Map(next.map((p: any) => [p.id, p]));
            const nextIds = new Set(next.map((p: any) => p.id));
            return prev
              .filter((p: any) => p.status !== 'sold' || nextIds.has(p.id))
              .map((p: any) => (byId.has(p.id) ? byId.get(p.id) : p));
          });
        },
        session: searchData.session,
        likedPosts: searchData.likedPosts,
        savedPosts: searchData.savedPosts,
        setLikedPosts: searchData.setLikedPosts,
        setSavedPosts: searchData.setSavedPosts,
        loadingMore: searchSoldSlice.loadingMore,
        hasMore: searchSoldSlice.hasMore,
        setPage: searchSoldSlice.setPage,
        fetchPosts: () => searchData.fetchSearch(),
      }
    : HOME_SOLD_STUB;

  return {
    recommendSource,
    soldSource,
  };
}
