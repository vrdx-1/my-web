'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { PhotoGrid } from './PhotoGrid';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { PostCardPrice } from './PostCardPrice';
import { PostCardCaption } from './PostCardCaption';
import { PostCardModals } from './PostCardModals';
import { PostCardHeader } from './PostCardHeader';
import { PostCardActions } from './PostCardActions';
import { type ExchangeRates } from '@/utils/exchangeRates';
import { usePostCard } from '@/hooks/usePostCard';


interface PostCardProps {
  post: any;
  index: number;
  isLastElement: boolean;
  session: any;
  savedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onViewPost: (post: any, imageIndex: number) => void;
  onSave: (postId: string) => void;
  onMenuSave?: (postId: string) => void;
  menuSaveLabel?: string;
  onShare: (post: any) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void | Promise<void>;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onRepost?: (postId: string, options?: { silentSuccessPopup?: boolean }) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  /** ลงทะเบียนการ์ดกับ observer สำหรับ viewport — ให้โพสต์ในจอได้ priority โหลดรูปก่อน */
  registerVisibilityRef?: (el: HTMLElement | null, index: number) => void;
  hideBoost?: boolean;
  leftOfAvatar?: React.ReactNode;
  showMenuButton?: boolean;
  /** โพสแรกในฟีด — รูปโหลดแบบ eager สำหรับ LCP */
  priority?: boolean;
  /** ลำดับโหลดรูปของการ์ด (โพสบนสุดก่อน แล้วไล่ลงล่าง): high / low — ส่งจาก feed ตาม index */
  imageFetchPriority?: 'high' | 'low' | 'auto';
  onProfileClick?: (post: any) => void;
  customCaption?: React.ReactNode;
  onPriceClick?: (post: any) => void;
  onLocalUpdate?: (postId: string, data: Record<string, unknown>) => void;
  exchangeRatesOverride?: ExchangeRates | null;
}

/** ไม่ใช้ React.memo เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" ในหน้า saved/liked/my-posts */
export function PostCard({
  post,
  index,
  isLastElement,
  session,
  savedPosts: _savedPosts,
  justSavedPosts: _justSavedPosts,
  activeMenuState,
  isMenuAnimating,
  lastPostElementRef,
  menuButtonRefs,
  onViewPost,
  onSave,
  onMenuSave,
  menuSaveLabel,
  onShare,
  onTogglePostStatus,
  onDeletePost,
  onReport,
  onRepost,
  onSetActiveMenu,
  onSetMenuAnimating,
  registerVisibilityRef,
  hideBoost = false,
  leftOfAvatar,
  showMenuButton = true,
  priority = false,
  imageFetchPriority,
  onProfileClick,
  customCaption,
  onPriceClick,
  onLocalUpdate,
  exchangeRatesOverride = null,
}: PostCardProps) {
  const {
    activeProfileId,
    isOwner,
    canQuickRepost,
    isSoldPost,
    normalizedCaption,
    priceValue,
    currencySymbol,
    priceText,
    estimatedLines,
    cardRef,
    showMarkSoldConfirm, setShowMarkSoldConfirm,
    showSoldInfo, setShowSoldInfo,
    showChangePriceModal, setShowChangePriceModal,
    showChangePriceSuccess, setShowChangePriceSuccess,
    showBoostStatusPopup, setShowBoostStatusPopup,
    boostStatusPopupStatus,
    boostStatusPopupExpiresAt,
    isQuickReposting,
    showPriceEstimatePopup, setShowPriceEstimatePopup,
    soldInfoCenterPosition,
    isTogglingStatus, setIsTogglingStatus,
    handleBoostClick,
    handleQuickRepost,
    openSoldInfoPopup,
    trackWhatsAppClick,
  } = usePostCard({ post, session, onRepost, exchangeRatesOverride });

  return (
    <div
      key={`${post.id}-${index}`}
      className="feed-card"
      ref={(node) => {
        cardRef.current = node;
        if (isLastElement && lastPostElementRef) lastPostElementRef(node);
      }}
      style={{
        borderBottom: '1px solid #c8ccd4',
        position: 'relative',
        overflowX: 'clip',
        overflowAnchor: 'none',
      }}
    >
      <PostCardHeader
        post={post}
        session={session}
        activeProfileId={activeProfileId}
        isOwner={isOwner}
        hideBoost={hideBoost}
        activeMenuState={activeMenuState}
        isMenuAnimating={isMenuAnimating}
        menuButtonRefs={menuButtonRefs}
        showMenuButton={showMenuButton}
        onProfileClick={onProfileClick}
        onSave={onSave}
        onMenuSave={onMenuSave}
        menuSaveLabel={menuSaveLabel}
        onShare={onShare}
        onDeletePost={onDeletePost}
        onReport={onReport}
        onRepost={onRepost}
        onSetActiveMenu={onSetActiveMenu}
        onSetMenuAnimating={onSetMenuAnimating}
        onBoostClick={handleBoostClick}
        canQuickRepost={canQuickRepost}
        isQuickReposting={isQuickReposting}
        onHandleQuickRepost={handleQuickRepost}
        leftOfAvatar={leftOfAvatar}
        eagerAvatar={priority}
      />

      <PostCardCaption
        normalizedCaption={normalizedCaption}
        customCaption={customCaption}
      />

      <div style={{ padding: 0 }}>
        <PhotoGrid images={post.images || []} preloadImages={post._preloadImages} onPostClick={(imageIndex) => onViewPost(post, imageIndex)} priority={priority} firstImageFetchPriority={imageFetchPriority} layout={post.layout || 'default'} gap={PHOTO_GRID_GAP} />
      </div>

      <div>
        <div
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
            overflow: 'visible',
          }}
        >
          <div
            style={{
              minWidth: 0,
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              overflow: 'visible',
            }}
          >
          <PostCardPrice
            post={post}
            priceValue={priceValue}
            currencySymbol={currencySymbol}
            priceText={priceText}
            isOwner={isOwner}
            onPriceClick={onPriceClick}
            showPriceEstimatePopup={showPriceEstimatePopup}
            setShowPriceEstimatePopup={setShowPriceEstimatePopup}
            estimatedLines={estimatedLines}
            onSetShowChangePriceModal={() => setShowChangePriceModal(true)}
            activeProfileId={activeProfileId}
            session={session}
          />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', minWidth: '32px', justifyContent: 'flex-end', flexShrink: 0, marginLeft: '12px' }}>
            <PostCardActions
              post={post}
              isOwner={isOwner}
              isSoldPost={isSoldPost}
              hideBoost={hideBoost}
              isTogglingStatus={isTogglingStatus}
              onBoostClick={handleBoostClick}
              onOpenSoldInfoPopup={openSoldInfoPopup}
              onSetShowMarkSoldConfirm={setShowMarkSoldConfirm}
              onTrackWhatsAppClick={trackWhatsAppClick}
            />
          </div>
        </div>
      </div>

      <PostCardModals
        post={post}
        isOwner={isOwner}
        isSoldPost={isSoldPost}
        showMarkSoldConfirm={showMarkSoldConfirm}
        setShowMarkSoldConfirm={setShowMarkSoldConfirm}
        showSoldInfo={showSoldInfo}
        setShowSoldInfo={setShowSoldInfo}
        soldInfoCenterPosition={soldInfoCenterPosition}
        showChangePriceModal={showChangePriceModal}
        setShowChangePriceModal={setShowChangePriceModal}
        showChangePriceSuccess={showChangePriceSuccess}
        setShowChangePriceSuccess={setShowChangePriceSuccess}
        showBoostStatusPopup={showBoostStatusPopup}
        setShowBoostStatusPopup={setShowBoostStatusPopup}
        boostStatusPopupStatus={boostStatusPopupStatus}
        boostStatusPopupExpiresAt={boostStatusPopupExpiresAt}
        isTogglingStatus={isTogglingStatus}
        setIsTogglingStatus={setIsTogglingStatus}
        onTogglePostStatus={onTogglePostStatus}
        onLocalUpdate={onLocalUpdate}
      />
    </div>
  );
}
