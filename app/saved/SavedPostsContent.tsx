'use client'

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// Shared Components
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { TabNavigation } from '@/components/TabNavigation';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import { ReportSuccessPopup } from '@/components/modals/ReportSuccessPopup';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';

// Shared Hooks
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';
import { MOTION_TRANSITIONS } from '@/utils/motionConstants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { supabase } from '@/lib/supabase';
import { trackViewModeClick } from '@/utils/viewModeClickAnalytics';

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** Feed อยู่ใน chunk แยก โหลดฝั่ง client เท่านั้น เพื่อหลีกเลี่ยง React "Expected static flag was missing" */
const SavedFeedBlock = dynamic(
  () => import('./SavedFeedBlock').then((mod) => ({ default: mod.SavedFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

const SavedCompactFeedBlock = dynamic(
  () => import('./SavedCompactFeedBlock').then((mod) => ({ default: mod.SavedCompactFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

type SavedSource = {
  table: 'post_saves' | 'post_saves_guest';
  column: 'user_id' | 'guest_token';
  idOrToken: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let savedViewModeMemory = false;

function isValidSavedKey(value: unknown): value is string {
  return typeof value === 'string' && value !== 'null' && value !== 'undefined' && value.trim().length > 0;
}

function SavedActionsMenuButton({
  compactMode,
  onToggleCompactMode,
  onClearAll,
  disableClearAll,
}: {
  compactMode: boolean;
  onToggleCompactMode: () => void;
  onClearAll: () => void;
  disableClearAll: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };

    const closeMenu = () => setIsOpen(false);

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', closeMenu, { passive: true });
    window.addEventListener('touchmove', closeMenu, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', closeMenu);
      window.removeEventListener('touchmove', closeMenu);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="ເປີດເມນູ"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          border: 'none',
          background: 'transparent',
          width: 44,
          height: 44,
          padding: 0,
          color: '#111111',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2.1" />
          <circle cx="12" cy="12" r="2.1" />
          <circle cx="19" cy="12" r="2.1" />
        </svg>
      </button>

      {isOpen && position && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 2200 }}>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.18)' }}
          />
          <div
            style={{
              position: 'absolute',
              top: position.top,
              right: position.right,
              width: 280,
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onToggleCompactMode();
              }}
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
                textAlign: 'left',
                padding: '14px 18px',
                fontSize: 17,
                lineHeight: '24px',
                fontWeight: 500,
                color: '#111111',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  width: 22,
                  height: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4a4d52',
                  flexShrink: 0,
                }}
              >
                {compactMode ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.4" />
                    <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.4" />
                    <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.4" />
                    <rect x="13" y="13" width="6.5" height="6.5" rx="1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="5" width="16" height="14" rx="2.2" />
                    <path d="M9 9h6" />
                    <path d="M9 12h6" />
                    <path d="M9 15h4" />
                  </svg>
                )}
              </span>
              <span>{compactMode ? 'ສະແດງແບບໃຫຍ່' : 'ສະແດງແບບນ້ອຍ'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClearAll();
              }}
              disabled={disableClearAll}
              style={{
                width: '100%',
                border: 'none',
                background: '#ffffff',
                textAlign: 'left',
                padding: '14px 18px',
                fontSize: 17,
                lineHeight: '24px',
                fontWeight: 500,
                color: disableClearAll ? '#9ca3af' : '#111111',
                cursor: disableClearAll ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  width: 22,
                  height: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: disableClearAll ? '#9ca3af' : '#4a4d52',
                  flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </span>
              <span>ລົບລາຍການທີ່ບັນທຶກທັງໝົດ</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function SavedPostsContent() {
  const [mounted, setMounted] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(savedViewModeMemory);
  const [tab, setTab] = useState('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [hasFetchedRecommend, setHasFetchedRecommend] = useState(false);
  const [hasFetchedSold, setHasFetchedSold] = useState(false);
  const [savedSource, setSavedSource] = useState<SavedSource | null | undefined>(undefined);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showClearAllSuccess, setShowClearAllSuccess] = useState(false);
  const fixedHeaderRef = useRef<HTMLDivElement | null>(null);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState(LAYOUT_CONSTANTS.HEADER_HEIGHT);
  const savedScopeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => {
      setFeedReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    savedViewModeMemory = isCompactMode;
  }, [isCompactMode]);

  useEffect(() => {
    const element = fixedHeaderRef.current;
    if (!element) {
      setFixedHeaderHeight(LAYOUT_CONSTANTS.HEADER_HEIGHT);
      return;
    }

    const updateHeaderHeight = () => {
      const nextHeight = element.offsetHeight;
      if (!nextHeight) return;
      setFixedHeaderHeight((prev) => (Math.abs(prev - nextHeight) < 1 ? prev : nextHeight));
    };

    updateHeaderHeight();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateHeaderHeight())
      : null;

    if (resizeObserver) {
      resizeObserver.observe(element);
    }

    window.addEventListener('resize', updateHeaderHeight, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const { session, sessionReady, activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();

  useEffect(() => {
    const userIdCandidate = activeProfileId || authUserId || session?.user?.id || null;
    if (isValidSavedKey(userIdCandidate) && UUID_PATTERN.test(userIdCandidate)) {
      setSavedSource({
        table: 'post_saves',
        column: 'user_id',
        idOrToken: userIdCandidate,
      });
      return;
    }

    const guestToken = getPrimaryGuestToken();
    if (isValidSavedKey(guestToken)) {
      setSavedSource({
        table: 'post_saves_guest',
        column: 'guest_token',
        idOrToken: guestToken,
      });
      return;
    }

    setSavedSource(null);
  }, [activeProfileId, authUserId, session?.user?.id]);

  const recommendListData = usePostListData({
    type: 'saved',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'recommend',
  });
  const soldListData = usePostListData({
    type: 'saved',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'sold',
  });

  const postListData = tab === 'recommend' ? recommendListData : soldListData;
  const savedScopeKey = activeProfileId || authUserId || session?.user?.id || 'guest';

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const setHeaderVisible = useSetHeaderVisibility();
  const headerScroll = useHeaderScroll({
    disableScrollHide: true,
    hideOnScrollUp: false,
    onVisibilityChange: (visible) => setHeaderVisible?.(visible),
  });

  const setHeaderVisibleFromScroll = (visible: boolean) => {
    headerScroll.setIsHeaderVisible(visible);
    setHeaderVisible?.(visible);
  };

  useEffect(() => {
    setHeaderVisible?.(true);
    return () => {
      setHeaderVisible?.(true);
    };
  }, [setHeaderVisible]);

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
  });

  const { toggleSave, removeSave } = usePostInteractions({
    session: postListData.session,
    activeProfileId,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    savedPosts: postListData.savedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustSavedPosts,
    onExistingSaveRefresh: (postId: string) => {
      postListData.setPosts((prev) => {
        const target = prev.find((post) => post.id === postId);
        if (!target) return prev;
        return [target, ...prev.filter((post) => post.id !== postId)];
      });
    },
    onRemoveSaveSuccess: (postId: string) => {
      postListData.setPosts((prev) => prev.filter((post) => post.id !== postId));
      postListData.setSavedPosts((prev) => ({ ...prev, [postId]: false }));
    },
  });

  useEffect(() => {
    if (!sessionReady || recommendListData.session === undefined) return;
    if (!hasFetchedRecommend && tab === 'recommend' && recommendListData.posts.length === 0 && !recommendListData.loadingMore) {
      setHasFetchedRecommend(true);
      recommendListData.setPage(0);
      recommendListData.setHasMore(true);
      recommendListData.fetchPosts(true);
    }
  }, [sessionReady, recommendListData.session, tab, recommendListData.posts.length, recommendListData.loadingMore, hasFetchedRecommend]);

  useEffect(() => {
    if (tab !== 'sold' || !sessionReady || soldListData.session === undefined) return;
    if (!hasFetchedSold && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      setHasFetchedSold(true);
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, sessionReady, soldListData.session, soldListData.posts.length, soldListData.loadingMore, hasFetchedSold]);

  useEffect(() => {
    if (!sessionReady || recommendListData.session === undefined) return;
    if (savedScopeKeyRef.current === null) {
      savedScopeKeyRef.current = savedScopeKey;
      return;
    }
    if (savedScopeKeyRef.current === savedScopeKey) return;

    savedScopeKeyRef.current = savedScopeKey;
    setHasFetchedRecommend(false);
    setHasFetchedSold(false);
    setTabRefreshing(true);

    recommendListData.setPosts([]);
    recommendListData.setPage(0);
    recommendListData.setHasMore(true);

    soldListData.setPosts([]);
    soldListData.setPage(0);
    soldListData.setHasMore(true);
  }, [
    savedScopeKey,
    sessionReady,
    recommendListData.session,
    recommendListData.setPosts,
    recommendListData.setPage,
    recommendListData.setHasMore,
    soldListData.setPosts,
    soldListData.setPage,
    soldListData.setHasMore,
  ]);

  useEffect(() => {
    if (!postListData.loadingMore) setTabRefreshing(false);
  }, [postListData.loadingMore]);

  useEffect(() => {
    if (recommendListData.page > 0 && !recommendListData.loadingMore && recommendListData.session !== undefined) {
      recommendListData.fetchPosts(false, recommendListData.page);
    }
  }, [recommendListData.page, recommendListData.session]);
  useEffect(() => {
    if (soldListData.page > 0 && !soldListData.loadingMore && soldListData.session !== undefined) {
      soldListData.fetchPosts(false, soldListData.page);
    }
  }, [soldListData.page, soldListData.session]);

  const handlers = usePostFeedHandlers({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    viewingPostHook,
    headerScroll,
    menu,
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
  });

  usePostModals({
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    setIsViewingModeOpen: viewingPostHook.setIsViewingModeOpen,
    setViewingModeDragOffset: viewingPostHook.setViewingModeDragOffset,
    initialImageIndex: viewingPostHook.initialImageIndex,
    savedScrollPosition: viewingPostHook.savedScrollPosition,
    fullScreenImages: fullScreenViewer.fullScreenImages,
    setFullScreenDragOffset: fullScreenViewer.setFullScreenDragOffset,
    setFullScreenVerticalDragOffset: fullScreenViewer.setFullScreenVerticalDragOffset,
    setFullScreenZoomScale: fullScreenViewer.setFullScreenZoomScale,
    setFullScreenZoomOrigin: fullScreenViewer.setFullScreenZoomOrigin,
    setFullScreenIsDragging: fullScreenViewer.setFullScreenIsDragging,
    setFullScreenTransitionDuration: fullScreenViewer.setFullScreenTransitionDuration,
    setFullScreenShowDetails: fullScreenViewer.setFullScreenShowDetails,
    setIsHeaderVisible: setHeaderVisibleFromScroll,
  });

  const { addBackStep } = useBackHandler();
  useEffect(() => {
    if (!fullScreenViewer.fullScreenImages) return;
    const close = () => {
      fullScreenViewer.setFullScreenImages(null);
      if (fullScreenViewer.activePhotoMenu !== null) {
        fullScreenViewer.setIsPhotoMenuAnimating(true);
        setTimeout(() => {
          fullScreenViewer.setActivePhotoMenu(null);
          fullScreenViewer.setIsPhotoMenuAnimating(false);
        }, 300);
      }
    };
    return addBackStep(close);
  }, [fullScreenViewer.fullScreenImages]);
  useEffect(() => {
    if (!viewingPostHook.viewingPost) return;
    const close = () => viewingPostHook.closeViewingMode(setHeaderVisibleFromScroll);
    return addBackStep(close);
  }, [viewingPostHook.viewingPost, setHeaderVisibleFromScroll, addBackStep, viewingPostHook]);

  const handleClearAllSaved = useCallback(async () => {
    if (!savedSource || isClearingAll) return;

    setIsClearingAll(true);

    const { error } = await supabase
      .from(savedSource.table)
      .delete()
      .eq(savedSource.column, savedSource.idOrToken);

    setIsClearingAll(false);
    if (error) return;

    setJustSavedPosts({});
    recommendListData.setPosts([]);
    recommendListData.setSavedPosts({});
    recommendListData.setPage(0);
    recommendListData.setHasMore(false);

    soldListData.setPosts([]);
    soldListData.setSavedPosts({});
    soldListData.setPage(0);
    soldListData.setHasMore(false);

    setHasFetchedRecommend(true);
    setHasFetchedSold(true);
    setTabRefreshing(false);
    setShowClearAllSuccess(true);
  }, [isClearingAll, recommendListData, savedSource, soldListData]);

  // Skeleton เฉพาะพื้นที่โพสต์ — Header + แท็บພ້ອມຂາຍ/ຂາຍແລ້ວ แสดงจริงเสมอ (เหมือนหน้า liked)
  const isFeedSkeleton = postListData.posts.length === 0 && postListData.loadingMore;
  const hasReadyRecommendFeed = hasFetchedRecommend || recommendListData.posts.length > 0;
  const hasReadySoldFeed = hasFetchedSold || soldListData.posts.length > 0;
  const showFeedSkeleton =
    !mounted ||
    !feedReady ||
    !sessionReady ||
    isFeedSkeleton ||
    (tab === 'recommend' ? !hasReadyRecommendFeed : !hasReadySoldFeed);
  const isHeaderVisible = headerScroll.isHeaderVisible;
  const headerSpacerStyle = {
    height: fixedHeaderHeight,
    pointerEvents: 'none' as const,
  };
  const canClearAll = savedSource !== undefined && savedSource !== null;

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>

      <div
        ref={fixedHeaderRef}
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          width: '100%',
          maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
          boxSizing: 'border-box',
          zIndex: 100,
          background: '#ffffff',
          backgroundColor: '#ffffff',
          transform: isHeaderVisible ? 'translateX(-50%)' : 'translate(-50%, -100%)',
          transition: MOTION_TRANSITIONS.HOME_CHROME,
          willChange: 'transform',
          pointerEvents: isHeaderVisible ? 'auto' : 'none',
        }}
      >
        <PageHeader
          title="ໂພສທີ່ບັນທຶກ"
          centerTitle
          hideBackButton
          showDivider={false}
          rightSlot={(
            <SavedActionsMenuButton
              compactMode={isCompactMode}
              onToggleCompactMode={() => {
                setIsCompactMode((prev) => !prev);
                void trackViewModeClick('saved');
              }}
              onClearAll={() => {
                setShowClearAllConfirm(true);
              }}
              disableClearAll={!canClearAll || isClearingAll}
            />
          )}
        />
        <TabNavigation
          className="home-tab-navigation"
          tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab={tab}
          onTabChange={(v) => {
            if (v === tab) {
              setTabRefreshing(true);
              const list = v === 'recommend' ? recommendListData : soldListData;
              list.setPage(0);
              list.setHasMore(true);
              list.fetchPosts(true);
              if (v === 'recommend') setHasFetchedRecommend(true);
              if (v === 'sold') setHasFetchedSold(true);
            } else {
              setTab(v);
              const targetList = v === 'recommend' ? recommendListData : soldListData;
              if (targetList.posts.length === 0) setTabRefreshing(true);
            }
          }}
          loadingTab={tabRefreshing ? tab : null}
        />
      </div>

      <div style={headerSpacerStyle} aria-hidden />

      {showFeedSkeleton ? (
        <FeedSkeleton count={3} />
      ) : isCompactMode ? (
        <SavedCompactFeedBlock
          showSkeleton={postListData.posts.length === 0 && postListData.loadingMore}
          skeletonCount={3}
          posts={postListData.posts}
          session={postListData.session}
          activeMenuState={menu.activeMenuState}
          isMenuAnimating={menu.isMenuAnimating}
          menuButtonRefs={menu.menuButtonRefs}
          onShare={handlers.handleShare}
          onDeletePost={handlers.handleDeletePost}
          onReport={handlers.handleReport}
          onRepost={handlers.handleRepost}
          onSetActiveMenu={menu.setActiveMenu}
          onSetMenuAnimating={menu.setIsMenuAnimating}
          hideBoost={tab === 'sold'}
          loadingMore={postListData.hasMore ? postListData.loadingMore : false}
          hasMore={postListData.hasMore}
          lastPostElementRef={lastPostElementRef}
          onRemoveSave={(postId) => {
            void removeSave(postId);
          }}
          onLocalUpdate={(postId, data) => {
            postListData.setPosts((prev) => prev.map((item) => (
              String(item.id) === String(postId)
                ? { ...item, ...data }
                : item
            )));
          }}
        />
      ) : (
        <SavedFeedBlock
          showSkeleton={postListData.posts.length === 0 && postListData.loadingMore}
          skeletonCount={3}
          posts={postListData.posts}
          session={postListData.session}
          savedPosts={postListData.savedPosts}
          justSavedPosts={justSavedPosts}
          activeMenuState={menu.activeMenuState}
          isMenuAnimating={menu.isMenuAnimating}
          lastPostElementRef={lastPostElementRef}
          menuButtonRefs={menu.menuButtonRefs}
          onViewPost={handlers.handleViewPost}
          onSave={toggleSave}
          onMenuSave={removeSave}
          menuSaveLabel="ຍົກເລີກບັນທຶກ"
          onShare={handlers.handleShare}
          onTogglePostStatus={handlers.handleTogglePostStatus}
          onDeletePost={handlers.handleDeletePost}
          onReport={handlers.handleReport}
          onRepost={handlers.handleRepost}
          onSetActiveMenu={menu.setActiveMenu}
          onSetMenuAnimating={menu.setIsMenuAnimating}
          loadingMore={postListData.hasMore ? postListData.loadingMore : false}
          hasMore={postListData.hasMore}
          onLoadMore={() => postListData.setPage((p) => p + 1)}
          hideBoost={tab === 'sold'}
        />
      )}

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={postListData.session}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => {
          viewingPostHook.closeViewingMode(setHeaderVisibleFromScroll);
        }}
        onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
        onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
        onViewingPostTouchEnd={(e: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(e, () => {})}
        onViewingPostImageClick={(images: string[], index: number) => {
          fullScreenViewer.setFullScreenImages(images);
          fullScreenViewer.setCurrentImgIndex(index);
        }}
        fullScreenImages={fullScreenViewer.fullScreenImages}
        currentImgIndex={fullScreenViewer.currentImgIndex}
        fullScreenDragOffset={fullScreenViewer.fullScreenDragOffset}
        fullScreenEntranceOffset={fullScreenViewer.fullScreenEntranceOffset}
        fullScreenVerticalDragOffset={fullScreenViewer.fullScreenVerticalDragOffset}
        fullScreenIsDragging={fullScreenViewer.fullScreenIsDragging}
        fullScreenTransitionDuration={fullScreenViewer.fullScreenTransitionDuration}
        fullScreenShowDetails={fullScreenViewer.fullScreenShowDetails}
        fullScreenZoomScale={fullScreenViewer.fullScreenZoomScale}
        fullScreenZoomOrigin={fullScreenViewer.fullScreenZoomOrigin}
        activePhotoMenu={fullScreenViewer.activePhotoMenu}
        isPhotoMenuAnimating={fullScreenViewer.isPhotoMenuAnimating}
        showDownloadBottomSheet={fullScreenViewer.showDownloadBottomSheet}
        isDownloadBottomSheetAnimating={fullScreenViewer.isDownloadBottomSheetAnimating}
        showImageForDownload={fullScreenViewer.showImageForDownload}
        onFullScreenClose={() => {
          fullScreenViewer.setFullScreenImages(null);
          if (fullScreenViewer.activePhotoMenu !== null) {
            setTimeout(() => {
              fullScreenViewer.setActivePhotoMenu(null);
            }, 300);
          }
        }}
        onFullScreenTouchStart={fullScreenViewer.fullScreenOnTouchStart}
        onFullScreenTouchMove={fullScreenViewer.fullScreenOnTouchMove}
        onFullScreenTouchEnd={fullScreenViewer.fullScreenOnTouchEnd}
        onFullScreenClick={fullScreenViewer.fullScreenOnClick}
        onFullScreenDownload={fullScreenViewer.downloadImage}
        onFullScreenImageIndexChange={fullScreenViewer.setCurrentImgIndex}
        onFullScreenPhotoMenuToggle={fullScreenViewer.setActivePhotoMenu}
        onFullScreenDownloadBottomSheetClose={() => {
          fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
          setTimeout(() => {
            fullScreenViewer.setShowDownloadBottomSheet(false);
            fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
          }, 300);
        }}
        onFullScreenDownloadBottomSheetDownload={() => {
          if (fullScreenViewer.showImageForDownload) {
            fullScreenViewer.downloadImage(fullScreenViewer.showImageForDownload);
          }
        }}
        onFullScreenImageForDownloadClose={() => fullScreenViewer.setShowImageForDownload(null)}
        reportingPost={reportingPost}
        reportReason={reportReason}
        isSubmittingReport={isSubmittingReport}
        onReportClose={() => setReportingPost(null)}
        onReportReasonChange={setReportReason}
        onReportSubmit={handlers.handleSubmitReport}
      />

      {/* ป๊อบอัพแสดงผลสำเร็จการส่งรายงาน */}
      {handlers.showReportSuccess && (
        <ReportSuccessPopup onClose={() => handlers.setShowReportSuccess?.(false)} />
      )}

      {/* Modal ยืนยันการลบโพสต์ */}
      {handlers.showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={handlers.handleConfirmDelete}
          onCancel={handlers.handleCancelDelete}
          loading={handlers.isDeletingPost}
        />
      )}

      {showClearAllConfirm && (
        <DeleteConfirmModal
          onConfirm={() => {
            void (async () => {
              await handleClearAllSaved();
              setShowClearAllConfirm(false);
            })();
          }}
          onCancel={() => setShowClearAllConfirm(false)}
          loading={isClearingAll}
          title="ລົບລາຍການທີ່ບັນທຶກທັງໝົດບໍ?"
          cancelLabel="ຍົກເລີກ"
          confirmLabel="ລົບ"
        />
      )}

      {/* ป๊อบอัพแสดงผลสำเร็จการลบโพสต์ */}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
      {handlers.showRepostSuccess && (
        <SuccessPopup message="ໂພສໃໝ່ສຳເລັດ" onClose={() => handlers.setShowRepostSuccess?.(false)} />
      )}
      {handlers.showToggleStatusSuccess && (
        <SuccessPopup message="ສຳເລັດ" onClose={() => handlers.setShowToggleStatusSuccess?.(false)} />
      )}
      {showClearAllSuccess && (
        <SuccessPopup message="ລົບສຳເລັດ" onClose={() => setShowClearAllSuccess(false)} />
      )}
    </main>
  );
}
