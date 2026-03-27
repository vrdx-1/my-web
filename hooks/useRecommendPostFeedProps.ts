'use client';

import { useMemo } from 'react';

type PostRecord = Record<string, unknown>;

interface UseRecommendPostFeedPropsOptions {
  posts: PostRecord[];
  session: unknown;
  savedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onViewPost: (post: PostRecord, imageIndex: number) => void;
  onSave: (postId: string) => void;
  onShare: (post: PostRecord) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: PostRecord) => void;
  onRepost?: (postId: string) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function useRecommendPostFeedProps(options: UseRecommendPostFeedPropsOptions) {
  return useMemo(
    () => ({
      posts: options.posts,
      session: options.session,
      savedPosts: options.savedPosts,
      justSavedPosts: options.justSavedPosts,
      activeMenuState: options.activeMenuState,
      isMenuAnimating: options.isMenuAnimating,
      lastPostElementRef: options.lastPostElementRef,
      menuButtonRefs: options.menuButtonRefs,
      onViewPost: options.onViewPost,
      onSave: options.onSave,
      onShare: options.onShare,
      onTogglePostStatus: options.onTogglePostStatus,
      onDeletePost: options.onDeletePost,
      onReport: options.onReport,
      onRepost: options.onRepost,
      onSetActiveMenu: options.onSetActiveMenu,
      onSetMenuAnimating: options.onSetMenuAnimating,
      loadingMore: options.loadingMore,
      hasMore: options.hasMore,
      onLoadMore: options.onLoadMore,
      hideBoost: false,
    }),
    [
      options.posts,
      options.session,
      options.savedPosts,
      options.justSavedPosts,
      options.activeMenuState,
      options.isMenuAnimating,
      options.lastPostElementRef,
      options.menuButtonRefs,
      options.onViewPost,
      options.onSave,
      options.onShare,
      options.onTogglePostStatus,
      options.onDeletePost,
      options.onReport,
      options.onRepost,
      options.onSetActiveMenu,
      options.onSetMenuAnimating,
      options.loadingMore,
      options.hasMore,
      options.onLoadMore,
    ],
  );
}
