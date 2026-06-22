'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
import { useFileUpload } from '@/hooks/useFileUpload';
import { useBackHandler } from '@/components/BackHandlerContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useSetHeaderVisibility } from '@/contexts/HeaderVisibilityContext';
import { getOwnedProfileIds } from '@/utils/postUtils';
import { MOTION_TRANSITIONS } from '@/utils/motionConstants';

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** ใช้ MyPostsFeedBlock (ไม่ใช้ PostFeed) เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
const MyPostsFeedBlock = dynamic(
  () => import('./MyPostsFeedBlock').then((mod) => ({ default: mod.MyPostsFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

const MyPostsCompactFeedBlock = dynamic(
  () => import('@/app/my-posts/MyPostsCompactFeedBlock').then((mod) => ({ default: mod.MyPostsCompactFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

let myPostsViewModeMemory = false;

function MyPostsActionsMenuButton({
  compactMode,
  onToggleCompactMode,
}: {
  compactMode: boolean;
  onToggleCompactMode: () => void;
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
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function MyPostsContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(myPostsViewModeMemory);
  const [tab, setTab] = useState('recommend');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [hasFetchedRecommend, setHasFetchedRecommend] = useState(false);
  const [hasFetchedSold, setHasFetchedSold] = useState(false);
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [subAccountPostCount, setSubAccountPostCount] = useState<number | null>(null);
  const [subAccountPostCountLoading, setSubAccountPostCountLoading] = useState(false);

  const { session, sessionReady, activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();
  const ownershipScopeKeyRef = useRef<string | null>(null);
  const fixedHeaderRef = useRef<HTMLDivElement | null>(null);
  const yearDropdownRef = useRef<HTMLDivElement | null>(null);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState<number>(
    Number.parseInt(LAYOUT_CONSTANTS.HEADER_HEIGHT, 10) || 118,
  );
  const yearSuggestions = useMemo(() => {
    const startYear = 2026;
    const minYear = 1980;
    return Array.from({ length: startYear - minYear + 1 }, (_, index) => startYear - index);
  }, []);
  const selectedYear = useMemo(() => {
    const trimmed = searchInput.trim();
    if (!/^\d{4}$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return yearSuggestions.includes(parsed) ? parsed : null;
  }, [searchInput, yearSuggestions]);

  const activeProfileRecord = useMemo(() => {
    const resolvedProfileId = activeProfileId || authUserId;
    if (!resolvedProfileId) return null;
    return availableProfiles.find((profile) => String(profile?.id) === String(resolvedProfileId)) ?? null;
  }, [activeProfileId, authUserId, availableProfiles]);

  const showSearchControls = Boolean(activeProfileRecord?.is_sub_account && activeProfileRecord?.parent_admin_id);
  const showMyPostsCreateButton = useMemo(() => {
    if (!activeProfileRecord?.is_sub_account || !activeProfileRecord?.parent_admin_id) return false;
    const parentAdminProfile = availableProfiles.find(
      (profile) => String(profile?.id) === String(activeProfileRecord.parent_admin_id),
    );
    return parentAdminProfile?.role === 'admin';
  }, [activeProfileRecord, availableProfiles]);
  const {
    hiddenFileInputRef: myPostsHiddenFileInputRef,
    handleFileChange: handleMyPostsFileChange,
    handleCreatePostClick: handleMyPostsCreatePostClick,
  } = useFileUpload({ redirectAfterSubmitPath: '/my-posts' });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    myPostsViewModeMemory = isCompactMode;
  }, [isCompactMode]);

  useEffect(() => {
    if (!showYearDropdown) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!yearDropdownRef.current?.contains(target)) {
        setShowYearDropdown(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowYearDropdown(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showYearDropdown]);

  useEffect(() => {
    if (showSearchControls) return;
    setShowYearDropdown(false);
  }, [showSearchControls]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setFeedReady(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    const element = fixedHeaderRef.current;
    if (!element) {
      setFixedHeaderHeight(Number.parseInt(LAYOUT_CONSTANTS.HEADER_HEIGHT, 10) || 118);
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
  }, [showSearchControls]);

  useEffect(() => {
    const targetProfileId = activeProfileId || session?.user?.id || null;

    if (!targetProfileId || !session) {
      setSubAccountPostCount(null);
      setSubAccountPostCountLoading(false);
      return;
    }

    let cancelled = false;
    setSubAccountPostCountLoading(true);

    const fetchSubAccountPostCount = async () => {
      const { count } = await supabase
        .from('cars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetProfileId);

      if (cancelled) return;
      setSubAccountPostCount(typeof count === 'number' ? count : 0);
      setSubAccountPostCountLoading(false);
    };

    void fetchSubAccountPostCount();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, session]);

  const recommendListData = usePostListData({
    type: 'my-posts',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'recommend',
    searchQuery,
  });
  const soldListData = usePostListData({
    type: 'my-posts',
    session,
    sessionReady,
    activeProfileId,
    authUserId,
    availableProfiles,
    tab: 'sold',
    searchQuery,
  });

  const ownershipScopeKey = (() => {
    const resolvedAuthUserId = authUserId || session?.user?.id || null;
    const ownedProfileIds = getOwnedProfileIds({
      activeProfileId,
      authUserId: resolvedAuthUserId,
      availableProfiles,
    });
    if (ownedProfileIds.length > 0) {
      return ownedProfileIds.slice().sort().join(',');
    }
    return activeProfileId || resolvedAuthUserId || 'guest';
  })();
  const searchScopeKey = searchQuery;

  const postListData = tab === 'recommend' ? recommendListData : soldListData;
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const setHeaderVisible = useSetHeaderVisibility();
  const headerScroll = useHeaderScroll({ disableScrollHide: true, hideOnScrollUp: false });

  const lockHeaderVisible = (visible: boolean) => {
    void visible;
    headerScroll.setIsHeaderVisible(true);
    setHeaderVisible?.(true);
  };

  const lockedHeaderScroll = {
    ...headerScroll,
    isHeaderVisible: true,
    setIsHeaderVisible: lockHeaderVisible,
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
    onLoadMore: () => postListData.setPage((prevPage) => prevPage + 1),
  });

  const { toggleSave } = usePostInteractions({
    session: postListData.session,
    activeProfileId,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    savedPosts: postListData.savedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustSavedPosts,
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
    if (!sessionReady || recommendListData.session === undefined) return;
    if (ownershipScopeKeyRef.current === null) {
      ownershipScopeKeyRef.current = ownershipScopeKey;
      return;
    }
    if (ownershipScopeKeyRef.current === ownershipScopeKey) return;

    ownershipScopeKeyRef.current = ownershipScopeKey;
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
    ownershipScopeKey,
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
    if (!sessionReady || recommendListData.session === undefined) return;

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
    searchScopeKey,
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
    if (tab !== 'sold' || !sessionReady || soldListData.session === undefined) return;
    if (!hasFetchedSold && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      setHasFetchedSold(true);
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, sessionReady, soldListData.session, soldListData.posts.length, soldListData.loadingMore, hasFetchedSold]);

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
    repostOptions: {
      // Keep current feed order/scroll position like Home; only update time on the post itself.
      reorderToTop: false,
    },
    viewingPostHook,
    headerScroll: lockedHeaderScroll,
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
    setIsHeaderVisible: lockHeaderVisible,
  });

  const { addBackStep } = useBackHandler();

  // iOS: ตั้ง touch-action ที่ body เพื่อให้ single tap ทำงานได้ ไม่ต้อง double tap (เฉพาะหน้านี้)
  useEffect(() => {
    const prev = document.body.style.touchAction;
    document.body.style.touchAction = 'manipulation';
    return () => {
      document.body.style.touchAction = prev;
    };
  }, []);

  const handleBack = useCallback(() => {
    router.push('/profile');
  }, [router]);
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
    const close = () => viewingPostHook.closeViewingMode();
    return addBackStep(close);
  }, [viewingPostHook.viewingPost]);

  const isFeedSkeleton = postListData.posts.length === 0 && postListData.loadingMore;
  const hasReadyRecommendFeed = hasFetchedRecommend || recommendListData.posts.length > 0;
  const hasReadySoldFeed = hasFetchedSold || soldListData.posts.length > 0;
  const showFeedSkeleton =
    !mounted ||
    !feedReady ||
    !sessionReady ||
    isFeedSkeleton ||
    (tab === 'recommend' ? !hasReadyRecommendFeed : !hasReadySoldFeed);
  const isHeaderVisible = lockedHeaderScroll.isHeaderVisible;
  const headerSpacerStyle = {
    height: fixedHeaderHeight,
    pointerEvents: 'none' as const,
  };

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <input
        type="file"
        ref={myPostsHiddenFileInputRef}
        multiple
        accept="image/*"
        onChange={handleMyPostsFileChange}
        style={{ display: 'none' }}
        aria-hidden
      />
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
          title={`ໂພສຂອງຂ້ອຍ  (${subAccountPostCountLoading ? '...' : (subAccountPostCount ?? 0)} ໂພສ)`} 
          centerTitle 
          onBack={handleBack} 
          showDivider={false}
          rightSlot={(
            <MyPostsActionsMenuButton
              compactMode={isCompactMode}
              onToggleCompactMode={() => setIsCompactMode((prev) => !prev)}
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
        {showSearchControls ? (
          <div
            style={{
              padding: '6px 12px 10px',
              borderBottom: '1px solid #eef2f7',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: 'relative',
                }}
                ref={yearDropdownRef}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 12,
                    padding: '8px 10px',
                    background: '#f9fafb',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="ຄົ້ນຫາໂພສຂອງຂ້ອຍ"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      // iOS Safari auto-zooms focused inputs smaller than 16px.
                      fontSize: 16,
                      color: '#111827',
                    }}
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      aria-label="ລ້າງຄຳຄົ້ນ"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowYearDropdown((prev) => !prev)}
                    aria-label="ເລືອກປີ"
                    aria-expanded={showYearDropdown}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: showYearDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>

                {showYearDropdown ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 140,
                      maxHeight: 'calc(100dvh - 210px - env(safe-area-inset-bottom, 0px))',
                      height: 'calc(100dvh - 210px - env(safe-area-inset-bottom, 0px))',
                      overflowY: 'auto',
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 10px 24px rgba(17, 24, 39, 0.12)',
                      zIndex: 120,
                    }}
                  >
                    {yearSuggestions.map((year) => {
                      const isActiveYear = selectedYear === year;
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setSearchInput(String(year));
                            setShowYearDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            background: isActiveYear ? '#eff6ff' : '#ffffff',
                            color: isActiveYear ? '#1d4ed8' : '#111827',
                            fontWeight: isActiveYear ? 700 : 500,
                            fontSize: 14,
                            lineHeight: '20px',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            textAlign: 'left',
                          }}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {showMyPostsCreateButton ? (
                <button
                  type="button"
                  onClick={() => handleMyPostsCreatePostClick(session)}
                  aria-label="ສ້າງໂພສ"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: 'none',
                    background: '#1877f2',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div style={headerSpacerStyle} aria-hidden />

      {showFeedSkeleton ? (
        <FeedSkeleton count={3} />
      ) : isCompactMode ? (
        <MyPostsCompactFeedBlock
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
          onSave={toggleSave}
        />
      ) : (
        <MyPostsFeedBlock
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
          viewingPostHook.closeViewingMode();
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
    </main>
  );
}
