'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Shared Components
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { TabNavigation } from '@/components/TabNavigation';
import { PostFeedModals } from '@/components/PostFeedModals';
import { PageHeader } from '@/components/PageHeader';
import {
  EditNameModal,
  EditPhoneModal,
  ProfileSection,
} from '@/app/(main)/profile/edit-profile/EditProfileSections';
import { useEditProfilePage } from '@/app/(main)/profile/edit-profile/useEditProfilePage';
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

// Shared Utils
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

/** ระยะจากด้านบน viewport ตอนแท็ບພ້ອມຂາຍ/ຂາຍແລ້ວ ติด sticky — ใกล้ความสูง PageHeader (~10+44+10) ไม่ให้ตัวหนังสือแท็บชิด header */
const MY_POSTS_STICKY_TABS_TOP_PX = 64;
/** ช่องว่างใต้ header / เหนือรายการโพสต์ เวลาเลื่อน */
const MY_POSTS_TAB_STRIP_PADDING_Y = { top: 8, bottom: 8 } as const;

/** ใช้ MyPostsFeedBlock (ไม่ใช้ PostFeed) เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
const MyPostsFeedBlock = dynamic(
  () => import('./MyPostsFeedBlock').then((mod) => ({ default: mod.MyPostsFeedBlock })),
  { ssr: false, loading: () => <FeedSkeleton count={3} /> }
);

export function MyPostsContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [tab, setTab] = useState('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setFeedReady(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [sessionState, setSessionState] = useState<any>(undefined);
  const hasFetchedRecommendRef = useRef(false);
  const hasFetchedSoldRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSessionState(session));
  }, []);

  const recommendListData = usePostListData({
    type: 'my-posts',
    session: sessionState,
    tab: 'recommend',
  });
  const soldListData = usePostListData({
    type: 'my-posts',
    session: sessionState,
    tab: 'sold',
  });

  const postListData = tab === 'recommend' ? recommendListData : soldListData;

  const {
    username,
    phone,
    avatarUrl,
    profileLoading,
    isEditingName,
    isEditingPhone,
    editingUsername,
    editingPhone,
    setEditingUsername,
    setEditingPhone,
    uploadAvatar,
    handleEditNameClick,
    handleEditPhoneClick,
    handleCancelPhoneEdit,
    handleCloseNameModal,
    handleSaveUsername,
    handleSavePhone,
  } = useEditProfilePage();

  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const headerScroll = useHeaderScroll();

  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
  });

  const { toggleSave } = usePostInteractions({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    savedPosts: postListData.savedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustSavedPosts,
  });

  useEffect(() => {
    if (sessionState === undefined || recommendListData.session === undefined) return;
    if (!hasFetchedRecommendRef.current && tab === 'recommend' && recommendListData.posts.length === 0 && !recommendListData.loadingMore) {
      hasFetchedRecommendRef.current = true;
      recommendListData.setPage(0);
      recommendListData.setHasMore(true);
      recommendListData.fetchPosts(true);
    }
  }, [sessionState, recommendListData.session, tab, recommendListData.posts.length, recommendListData.loadingMore]);

  useEffect(() => {
    if (tab !== 'sold' || sessionState === undefined || soldListData.session === undefined) return;
    if (!hasFetchedSoldRef.current && soldListData.posts.length === 0 && !soldListData.loadingMore) {
      hasFetchedSoldRef.current = true;
      soldListData.setPage(0);
      soldListData.setHasMore(true);
      soldListData.fetchPosts(true);
    }
  }, [tab, sessionState, soldListData.session, soldListData.posts.length, soldListData.loadingMore]);

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
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
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

  // Skeleton ทั้งบล็อกโปรไฟล์+แท็บ+feed — ห้ามใช้สถานะ “โพสต์ว่าง+ยังไม่โหลด” ของแท็บปัจจุบัน เพราะตอนสลับไป ຂາຍແລ້ວ ครั้งแรกจะทำให้กระพริบทั้งหน้า
  const showFullSkeleton =
    !mounted || !feedReady || profileLoading || sessionState === undefined;

  /** ฟีดว่างและยังโหลด/ยังมีหน้าถัดไปได้ — รวมช่วงก่อน loadingMore เป็น true (ไม่กระพริบ EmptyState) */
  const showFeedBlockSkeleton =
    postListData.posts.length === 0 && (postListData.loadingMore || postListData.hasMore);

  return (
    <main
      style={{
        ...LAYOUT_CONSTANTS.MAIN_CONTAINER,
        ...((isEditingName || isEditingPhone)
          ? {
              overflow: 'hidden',
              touchAction: 'none',
              overscrollBehavior: 'contain',
            }
          : { touchAction: 'manipulation' }),
      }}
      onTouchMove={
        isEditingName || isEditingPhone
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
      onWheel={
        isEditingName || isEditingPhone
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      {/* Overlay when editing name or phone - คลุมทั้งจอและล็อกพื้นหลัง ไม่ให้แตะหรือสกรอล์ส่วนอื่นขณะเปลี่ยนชื่อ/กรอกเบอร์โทร */}
      {(isEditingName || isEditingPhone) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999,
            pointerEvents: 'auto',
            touchAction: 'none',
            overscrollBehavior: 'contain',
            overflow: 'hidden',
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}

      <EditNameModal
        isOpen={isEditingName}
        editingUsername={editingUsername}
        setEditingUsername={setEditingUsername}
        onClose={handleCloseNameModal}
        onSave={handleSaveUsername}
      />

      <EditPhoneModal
        isOpen={isEditingPhone}
        editingPhone={editingPhone}
        setEditingPhone={setEditingPhone}
        onCancel={handleCancelPhoneEdit}
        onSave={handleSavePhone}
      />

      <PageHeader title="ໂພສຂອງຂ້ອຍ" centerTitle onBack={handleBack} />
      {showFullSkeleton ? (
        <div
          className="my-posts-profile-skeleton"
          style={{ padding: '20px', borderBottom: 'none' }}
          aria-hidden
        >
          <style>{`
            @keyframes my-posts-profile-skeleton-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                backgroundSize: '200% 100%',
                animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, paddingTop: 0 }}>
              <div
                style={{
                  height: 18,
                  width: '70%',
                  maxWidth: 160,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  height: 44,
                  width: '100%',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <ProfileSection
          avatarUrl={avatarUrl}
          username={username}
          phone={phone}
          onAvatarChange={uploadAvatar}
          onEditNameClick={handleEditNameClick}
          onEditPhoneClick={handleEditPhoneClick}
          showDivider={false}
          variant="my-posts"
        />
      )}
      {showFullSkeleton ? (
        <div
          style={{
            position: 'sticky',
            top: MY_POSTS_STICKY_TABS_TOP_PX,
            zIndex: 99,
            background: '#ffffff',
            backgroundColor: '#ffffff',
            display: 'flex',
            minHeight: 32,
            paddingTop: MY_POSTS_TAB_STRIP_PADDING_Y.top,
            paddingBottom: MY_POSTS_TAB_STRIP_PADDING_Y.bottom,
          }}
          aria-hidden
        >
          <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 32, width: '100%' }}>
            {/* Skeleton tabs: ไม่แสดงตัวหนังสือ */}
            <div
              style={{
                flex: 1,
                minHeight: 32,
                padding: '0px 15px 0px 15px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  height: 14,
                  width: '70%',
                  maxWidth: 140,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                  marginTop: 4,
                }}
              />
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 32,
                padding: '0px 15px 0px 15px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  height: 14,
                  width: '60%',
                  maxWidth: 140,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
                  marginTop: 4,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'sticky',
            top: MY_POSTS_STICKY_TABS_TOP_PX,
            zIndex: 99,
            background: '#ffffff',
            backgroundColor: '#ffffff',
            paddingTop: MY_POSTS_TAB_STRIP_PADDING_Y.top,
            paddingBottom: MY_POSTS_TAB_STRIP_PADDING_Y.bottom,
          }}
        >
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
                if (v === 'sold') hasFetchedSoldRef.current = true;
              } else {
                setTab(v);
                const targetList = v === 'recommend' ? recommendListData : soldListData;
                if (targetList.posts.length === 0) setTabRefreshing(true);
              }
            }}
            loadingTab={tabRefreshing ? tab : null}
          />
        </div>
      )}

      {showFullSkeleton ? (
        <FeedSkeleton count={3} />
      ) : (
        <MyPostsFeedBlock
          showSkeleton={showFeedBlockSkeleton}
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
        />
      )}

      {/* ป๊อบอัพแสดงผลสำเร็จการลบโพสต์ */}
      {handlers.showDeleteSuccess && (
        <SuccessPopup message="ລົບໂພສສຳເລັດ" onClose={() => handlers.setShowDeleteSuccess?.(false)} />
      )}
    </main>
  );
}
