'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { PostCardMenu } from './PostCardMenu';
import { formatTime, isPostOwner } from '@/utils/postUtils';
import { commonStyles } from '@/utils/commonStyles';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PrivateNotePopup } from './modals/PrivateNotePopup';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';

const CAPTION_TOGGLE_TRANSITION_LOCK_MS = 260;

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
  onRepost?: (postId: string) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  /** ลงทะเบียนการ์ดกับ observer สำหรับ viewport — ให้โพสต์ในจอได้ priority โหลดรูปก่อน */
  registerVisibilityRef?: (el: HTMLElement | null, index: number) => void;
  hideBoost?: boolean;
  leftOfAvatar?: React.ReactNode;
  /** โพสแรกในฟีด — รูปโหลดแบบ eager สำหรับ LCP */
  priority?: boolean;
  /** ลำดับโหลดรูปของการ์ด (โพสบนสุดก่อน แล้วไล่ลงล่าง): high / low — ส่งจาก feed ตาม index */
  imageFetchPriority?: 'high' | 'low' | 'auto';
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
  priority = false,
  imageFetchPriority,
}: PostCardProps) {
  const router = useRouter();
  const { activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();
  const isOwner = isPostOwner(post, session, activeProfileId, authUserId, availableProfiles);
  const isSoldPost = post.status === 'sold';
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = React.useState(false);
  const [showSoldInfo, setShowSoldInfo] = React.useState(false);
  const [showPrivateNotePopup, setShowPrivateNotePopup] = React.useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
  const [isCaptionOverflowing, setIsCaptionOverflowing] = React.useState(false);
  const [isCaptionSingleLine, setIsCaptionSingleLine] = React.useState(false);
  const [collapsedCaption, setCollapsedCaption] = React.useState('');
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const captionRef = React.useRef<HTMLDivElement | null>(null);
  const captionToggleUnlockTimeoutRef = React.useRef<number | null>(null);
  const normalizedCaption = React.useMemo(() => {
    const rawCaption = typeof post.caption === 'string' ? post.caption : '';
    return rawCaption.replace(/\s+$/u, '');
  }, [post.caption]);
  const priceValue = React.useMemo(() => {
    const rawPrice = post.price;
    if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) return rawPrice;
    if (typeof rawPrice === 'string') {
      const digitsOnly = rawPrice.replace(/\D/g, '');
      if (!digitsOnly) return null;
      const parsed = Number(digitsOnly);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [post.price]);
  const currencySymbol = post.price_currency === '฿' || post.price_currency === '$'
    ? post.price_currency
    : '₭';
  const priceText = priceValue && priceValue > 0
    ? `${priceValue.toLocaleString('en-US')} ${currencySymbol}`
    : 'ບໍ່ລະບຸລາຄາ';

  const clearCaptionToggleStabilizers = React.useCallback(() => {
    if (typeof window !== 'undefined' && captionToggleUnlockTimeoutRef.current != null) {
      window.clearTimeout(captionToggleUnlockTimeoutRef.current);
      captionToggleUnlockTimeoutRef.current = null;
    }
    if (typeof document !== 'undefined') {
      delete document.body.dataset.captionToggleActive;
    }
  }, []);

  React.useEffect(() => {
    const anyModalOpen = showMarkSoldConfirm || showSoldInfo || showPrivateNotePopup;
    if (typeof document === 'undefined' || !anyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showMarkSoldConfirm, showSoldInfo, showPrivateNotePopup]);

  React.useEffect(() => {
    if (!registerVisibilityRef) return;
    const el = cardRef.current;
    if (el) registerVisibilityRef(el, index);
    return () => registerVisibilityRef(null, index);
  }, [registerVisibilityRef, index]);

  React.useEffect(() => {
    clearCaptionToggleStabilizers();
    setIsCaptionExpanded(false);
  }, [post.id, normalizedCaption, clearCaptionToggleStabilizers]);

  React.useEffect(() => clearCaptionToggleStabilizers, [clearCaptionToggleStabilizers]);

  const updateCollapsedCaption = React.useCallback(() => {
    const captionEl = captionRef.current;
    const fullCaption = normalizedCaption;

    if (!captionEl || fullCaption.trim() === '') {
      setIsCaptionOverflowing(false);
      setIsCaptionSingleLine(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    const style = window.getComputedStyle(captionEl);
    const paddingLeft = parseFloat(style.paddingLeft || '0');
    const paddingRight = parseFloat(style.paddingRight || '0');
    const contentWidth = Math.max(0, captionEl.clientWidth - paddingLeft - paddingRight);
    const lineHeight = 21;
    const maxHeight = lineHeight * 2;

    if (contentWidth <= 0) {
      setIsCaptionOverflowing(false);
      setIsCaptionSingleLine(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    const measureEl = document.createElement('div');
    measureEl.style.position = 'fixed';
    measureEl.style.left = '-99999px';
    measureEl.style.top = '0';
    measureEl.style.width = `${contentWidth}px`;
    measureEl.style.whiteSpace = 'pre-wrap';
    measureEl.style.wordBreak = 'break-word';
    measureEl.style.fontSize = style.fontSize;
    measureEl.style.fontWeight = style.fontWeight;
    measureEl.style.fontFamily = style.fontFamily;
    measureEl.style.lineHeight = `${lineHeight}px`;
    measureEl.style.letterSpacing = style.letterSpacing;
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';

    document.body.appendChild(measureEl);

    const readMoreSuffix = ' ອ່ານເພີ່ມ';
    const ellipsis = '...';

    measureEl.textContent = fullCaption;
    const measuredHeight = measureEl.scrollHeight;
    const fullFits = measuredHeight <= maxHeight + 1;
    setIsCaptionSingleLine(measuredHeight <= lineHeight + 1);

    if (fullFits) {
      document.body.removeChild(measureEl);
      setIsCaptionOverflowing(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    let low = 0;
    let high = fullCaption.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${fullCaption.slice(0, mid).trimEnd()}${ellipsis}${readMoreSuffix}`;
      measureEl.textContent = candidate;

      if (measureEl.scrollHeight <= maxHeight + 1) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    document.body.removeChild(measureEl);
    setIsCaptionOverflowing(true);
    setCollapsedCaption(`${fullCaption.slice(0, best).trimEnd()}${ellipsis}`);
  }, [normalizedCaption]);

  const handleCaptionToggle = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCaptionOverflowing) return;
    if (typeof window !== 'undefined') {
      if (typeof document !== 'undefined') {
        document.body.dataset.captionToggleActive = 'true';
      }
      if (captionToggleUnlockTimeoutRef.current != null) {
        window.clearTimeout(captionToggleUnlockTimeoutRef.current);
      }
      captionToggleUnlockTimeoutRef.current = window.setTimeout(() => {
        captionToggleUnlockTimeoutRef.current = null;
        if (typeof document !== 'undefined') {
          delete document.body.dataset.captionToggleActive;
        }
      }, CAPTION_TOGGLE_TRANSITION_LOCK_MS);
      window.dispatchEvent(new CustomEvent('postcard:caption-toggle'));
    }
    setIsCaptionExpanded((prev) => !prev);
  }, [isCaptionOverflowing]);

  React.useEffect(() => {
    if (isCaptionExpanded) return;

    updateCollapsedCaption();

    const captionEl = captionRef.current;
    if (!captionEl) return;

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateCollapsedCaption);
      return () => window.removeEventListener('resize', updateCollapsedCaption);
    }

    const observer = new ResizeObserver(() => updateCollapsedCaption());
    observer.observe(captionEl);
    return () => observer.disconnect();
  }, [isCaptionExpanded, updateCollapsedCaption]);

  // ไม่ใช้ content-visibility:auto บนฟีด — ตอนโพสโหลด/สูงเปลี่ยน ทำให้ scroll anchor กระตุกแล้ว header สั่น
  const cardStyle: React.CSSProperties = {
    borderBottom: '1px solid #c8ccd4',
    position: 'relative',
    overflowX: 'clip',
    overflowAnchor: 'none',
  };

    return (
    <div
      key={`${post.id}-${index}`}
      className="feed-card"
      ref={(node) => {
        cardRef.current = node;
        if (isLastElement && lastPostElementRef) lastPostElementRef(node);
      }}
      style={cardStyle}
    >
      {/* Post Header */}
      <div style={{ ...commonStyles.postHeader, gap: '10px' }}>
        {leftOfAvatar && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {leftOfAvatar}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <Avatar avatarUrl={post.profiles?.avatar_url} size={40} session={session} />
        </div>
        <div style={{ flex: 1, minWidth: 0, marginTop: '2px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '3px', color: '#111111' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#111111' }}>
              {post.profiles?.username?.toLowerCase() === 'guest user' ? 'User' : (post.profiles?.username || 'User')}
            </span>
            {post.profiles?.is_verified && (
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                style={{ flexShrink: 0 }}
                aria-label="Verified"
              >
                <g fill="#2d9bf0">
                  <circle cx="12" cy="12" r="8.2"/>
                  <circle cx="12" cy="4.7" r="3.5"/>
                  <circle cx="17.2" cy="6.8" r="3.5"/>
                  <circle cx="19.3" cy="12" r="3.5"/>
                  <circle cx="17.2" cy="17.2" r="3.5"/>
                  <circle cx="12" cy="19.3" r="3.5"/>
                  <circle cx="6.8" cy="17.2" r="3.5"/>
                  <circle cx="4.7" cy="12" r="3.5"/>
                  <circle cx="6.8" cy="6.8" r="3.5"/>
                </g>
                <path d="M7.1 12.9L10.3 16.1L17.1 9.2L15.5 7.6L10.3 12.8L8.7 11.3L7.1 12.9Z" fill="white"/>
              </svg>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#4a4d52', lineHeight: '18px', marginTop: '0px' }}>
            {post.is_boosted && !hideBoost && post.status !== 'sold' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#4a4d52', flexWrap: 'wrap' }}>
                <span style={{ color: '#4a4d52' }}>{formatTime(post.created_at)}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#9ea2a7',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ color: '#4a4d52' }}>{post.province}</span>
                {post.short_id ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '3px',
                        height: '3px',
                        borderRadius: '50%',
                        backgroundColor: '#9ea2a7',
                        margin: '0 6px',
                        transform: 'translateY(1px)',
                      }}
                    />
                    <span style={{ color: '#4a4d52', fontWeight: 400 }}>
                      ID: {String(post.short_id).slice(0, 6)}
                    </span>
                  </>
                ) : null}
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#9ea2a7',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#4a4d52' }}>Ad</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#4a4d52', flexWrap: 'wrap' }}>
                <span style={{ color: '#4a4d52' }}>{formatTime(post.created_at)}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#9ea2a7',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ color: '#4a4d52' }}>{post.province}</span>
                {post.short_id ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '3px',
                        height: '3px',
                        borderRadius: '50%',
                        backgroundColor: '#9ea2a7',
                        margin: '0 6px',
                        transform: 'translateY(1px)',
                      }}
                    />
                    <span style={{ color: '#4a4d52', fontWeight: 400 }}>
                      ID: {String(post.short_id).slice(0, 6)}
                    </span>
                  </>
                ) : null}
              </span>
            )}
          </div>
        </div>
        
        {/* Menu Button */}
        <div style={{ marginTop: '-2px' }}>
          <PostCardMenu
            post={post}
            isOwner={isOwner}
            hideBoost={hideBoost}
            activeMenuState={activeMenuState}
            isMenuAnimating={isMenuAnimating}
            menuButtonRefs={menuButtonRefs}
            onSave={onMenuSave || onSave}
            saveLabel={menuSaveLabel}
            onShare={onShare}
            onDeletePost={onDeletePost}
            onReport={onReport}
            onRepost={onRepost}
            onSetActiveMenu={onSetActiveMenu}
            onSetMenuAnimating={onSetMenuAnimating}
            onOpenPrivateNote={() => {
              onSetActiveMenu(null);
              setShowPrivateNotePopup(true);
            }}
          />
        </div>
      </div>

      {/* Caption */}
      {normalizedCaption.trim() !== '' && (
        <div
          role="text"
          ref={captionRef}
          onClick={handleCaptionToggle}
          style={{
            padding: isCaptionExpanded
              ? '0 15px 0 15px'
              : isCaptionSingleLine
                ? '0 15px 4px 15px'
                : '0 15px 8px 15px',
            marginBottom: isCaptionExpanded ? '6px' : isCaptionSingleLine ? '2px' : '6px',
            fontSize: '15px',
            lineHeight: '21px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#111111',
            fontWeight: 500,
            userSelect: 'text',
            WebkitUserSelect: 'text',
            overflow: isCaptionExpanded ? 'visible' : 'hidden',
            maxHeight: isCaptionExpanded ? 'none' : '42px',
            overflowAnchor: 'none',
            cursor: isCaptionOverflowing ? 'pointer' : 'text',
          }}
        >
          {isCaptionExpanded || !isCaptionOverflowing ? normalizedCaption : collapsedCaption}
          {!isCaptionExpanded && isCaptionOverflowing && (
            <button
              type="button"
              onClick={handleCaptionToggle}
              aria-label="ອ່ານເພີ່ມ"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#8a8d91',
                fontSize: '15px',
                lineHeight: '21px',
                fontWeight: 400,
                cursor: 'pointer',
                marginLeft: '4px',
                padding: 0,
              }}
            >
              ອ່ານເພີ່ມ
            </button>
          )}
        </div>
      )}

      {/* Photo Grid — เต็มความกว้างหน้าจอ (รูปเต็มหน้าจอ) */}
      <div style={{ padding: 0 }}>
        <PhotoGrid images={post.images || []} preloadImages={post._preloadImages} onPostClick={(imageIndex) => onViewPost(post, imageIndex)} priority={priority} firstImageFetchPriority={imageFetchPriority} layout={post.layout || 'default'} gap={PHOTO_GRID_GAP} />
      </div>

      {/* Post Actions */}
      <div>
        <div
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                padding: '8px 16px',
                minHeight: '34px',
                borderRadius: '12px',
                color: '#1c1e21',
                border: '1px solid #d1d5db',
                boxShadow: 'none',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  color: '#1c1e21',
                  fontSize: '16px',
                  lineHeight: '21px',
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {priceText}
              </span>
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', minWidth: '32px', justifyContent: 'flex-end', flexShrink: 0, marginLeft: '12px' }}>
            {isOwner ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSoldPost) {
                    setShowSoldInfo(true);
                    return;
                  }
                  if (!isSoldPost) {
                    setShowMarkSoldConfirm(true);
                    return;
                  }
                  onTogglePostStatus(post.id, post.status);
                }} 
                style={{ 
                  background: '#e0245e', 
                  padding: '4px 12px', 
                  minHeight: '28px',
                  lineHeight: '18px',
                  borderRadius: '10px', 
                  border: 'none', 
                  color: '#fff', 
                  fontWeight: 'bold', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                }}
              >
                {isSoldPost ? 'ຂາຍແລ້ວ' : 'ແຈ້ງວ່າຂາຍແລ້ວ'}
              </button>
            ) : (
              isSoldPost ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSoldInfo(true);
                  }}
                  style={{
                    background: '#e0245e',
                    padding: '4px 12px',
                    minHeight: '28px',
                    lineHeight: '18px',
                    borderRadius: '10px',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ຂາຍແລ້ວ
                </button>
              ) : (
                (() => {
                  const raw = post.profiles?.phone || '';
                  const digits = raw.replace(/\D/g, '');
                  if (digits.length < 8) return null;
                  const waUrl = `https://wa.me/${digits}`;
                  return (
                <a 
                  href={waUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="ຕິດຕໍ່ WhatsApp"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#e4e6eb',
                    padding: '6px 14px',
                    minHeight: '28px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: '#1c1e21',
                    boxShadow: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>
                  );
                })()
              )
            )}

          </div>
        </div>
      </div>

      {/* Confirm Mark as Sold Modal (same design as logout confirm) - portal to body for full-screen overlay + center of viewport */}
      {typeof document !== 'undefined' && isOwner && !isSoldPost && showMarkSoldConfirm && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
              ລົດຄັນນີ້ ຂາຍແລ້ວບໍ?
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setShowMarkSoldConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: 'pointer',
                }}
              >
                ຍັງບໍ່ທັນຂາຍ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsTogglingStatus(true);
                  setShowMarkSoldConfirm(false);
                  try {
                    await onTogglePostStatus(post.id, post.status);
                  } finally {
                    setIsTogglingStatus(false);
                  }
                }}
                disabled={isTogglingStatus}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: isTogglingStatus ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isTogglingStatus ? 0.6 : 1,
                }}
              >
                {isTogglingStatus ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ButtonSpinner />
                  </span>
                ) : 'ຂາຍແລ້ວ'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sold Info Modal (same design size as logout confirm) - portal to body for full-screen overlay + center of viewport */}
      {typeof document !== 'undefined' && isSoldPost && showSoldInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
              ຂາຍແລ້ວເດີ
            </h3>
            <button
              type="button"
              onClick={() => setShowSoldInfo(false)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#1877f2',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ຕົກລົງ
            </button>
          </div>
        </div>,
        document.body
      )}

      {showPrivateNotePopup && (
        <PrivateNotePopup
          show={showPrivateNotePopup}
          postId={post.id}
          session={session}
          onClose={() => setShowPrivateNotePopup(false)}
        />
      )}
    </div>
  );
}
