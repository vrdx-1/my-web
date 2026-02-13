'use client'

import { useMemo } from 'react';

/**
 * Custom hook สำหรับสร้างและ memoize PostFeed props
 * แยก logic เพื่อลดความซับซ้อนของ HomeContent และ optimize performance
 */
export function usePostFeedProps({
  posts,
  session,
  likedPosts,
  savedPosts,
  justLikedPosts,
  justSavedPosts,
  activeMenuState,
  isMenuAnimating,
  lastPostElementRef,
  menuButtonRefs,
  menu,
  postFeedHandlers,
  toggleLike,
  toggleSave,
  handleViewLikes,
  handleViewSaves,
  loadingMore,
  hasMore,
}: {
  posts: any[];
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  justLikedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef: ((node: HTMLElement | null) => void) | undefined;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  menu: {
    setActiveMenu: (postId: string | null) => void;
    setIsMenuAnimating: (animating: boolean) => void;
  };
  postFeedHandlers: {
    handleViewPost: (post: any, imageIndex: number) => void;
    handleImpression: (postId: string) => void;
    handleShare: (post: any) => void;
    handleTogglePostStatus: (postId: string, currentStatus: string) => void;
    handleDeletePost: (postId: string) => void;
    handleReport: (post: any) => void;
  };
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  handleViewLikes: (postId: string) => void;
  handleViewSaves: (postId: string) => void;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  return useMemo(() => ({
    posts,
    session,
    likedPosts,
    savedPosts,
    justLikedPosts,
    justSavedPosts,
    activeMenuState,
    isMenuAnimating,
    lastPostElementRef,
    menuButtonRefs,
    onViewPost: postFeedHandlers.handleViewPost,
    onImpression: postFeedHandlers.handleImpression,
    onLike: toggleLike,
    onSave: toggleSave,
    onShare: postFeedHandlers.handleShare,
    onViewLikes: handleViewLikes,
    onViewSaves: handleViewSaves,
    onTogglePostStatus: postFeedHandlers.handleTogglePostStatus,
    onDeletePost: postFeedHandlers.handleDeletePost,
    onReport: postFeedHandlers.handleReport,
    onSetActiveMenu: menu.setActiveMenu,
    onSetMenuAnimating: menu.setIsMenuAnimating,
    loadingMore,
    hasMore,
  }), [
    posts,
    session,
    likedPosts,
    savedPosts,
    justLikedPosts,
    justSavedPosts,
    activeMenuState,
    isMenuAnimating,
    lastPostElementRef,
    menuButtonRefs,
    postFeedHandlers.handleViewPost,
    postFeedHandlers.handleImpression,
    toggleLike,
    toggleSave,
    postFeedHandlers.handleShare,
    handleViewLikes,
    handleViewSaves,
    postFeedHandlers.handleTogglePostStatus,
    postFeedHandlers.handleDeletePost,
    postFeedHandlers.handleReport,
    menu.setActiveMenu,
    menu.setIsMenuAnimating,
    loadingMore,
    hasMore,
  ]);
}
