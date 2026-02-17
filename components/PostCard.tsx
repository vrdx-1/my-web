'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { PostCardMenu } from './PostCardMenu';
import { formatTime, getOnlineStatus, isPostOwner } from '@/utils/postUtils';
import { commonStyles } from '@/utils/commonStyles';
import { formatCompactNumber } from '@/utils/currency';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { ShareIconTraced } from './icons/ShareIconTraced';

interface PostCardProps {
  post: any;
  index: number;
  isLastElement: boolean;
  session: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  justLikedPosts: { [key: string]: boolean };
  justSavedPosts: { [key: string]: boolean };
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onViewPost: (post: any, imageIndex: number) => void;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (post: any) => void;
  onViewLikes: (postId: string) => void;
  onViewSaves: (postId: string) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void | Promise<void>;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  onImpression?: (postId: string) => void;
  hideBoost?: boolean;
  leftOfAvatar?: React.ReactNode;
  /** โพสแรกในฟีด — รูปโหลดแบบ eager สำหรับ LCP */
  priority?: boolean;
}

export const PostCard = React.memo<PostCardProps>(({
  post,
  index,
  isLastElement,
  session,
  likedPosts,
  savedPosts,
  justLikedPosts,
  justSavedPosts,
  activeMenuState,
  isMenuAnimating,
  lastPostElementRef,
  menuButtonRefs,
  onViewPost,
  onLike,
  onSave,
  onShare,
  onViewLikes,
  onViewSaves,
  onTogglePostStatus,
  onDeletePost,
  onReport,
  onSetActiveMenu,
  onSetMenuAnimating,
  onImpression,
  hideBoost = false,
  leftOfAvatar,
  priority = false,
}) => {
  const router = useRouter();
  const status = getOnlineStatus(post.profiles?.last_seen);
  const statusLabel = status.text ? (status.isOnline ? 'ອອນລາຍ' : status.text) : '';
  const isOwner = isPostOwner(post, session);
  const isSoldPost = post.status === 'sold';
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = React.useState(false);
  const [showSoldInfo, setShowSoldInfo] = React.useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const impressionSentRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const anyModalOpen = showMarkSoldConfirm || showSoldInfo;
    if (typeof document === 'undefined' || !anyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showMarkSoldConfirm, showSoldInfo]);

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el || !onImpression) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || impressionSentRef.current.has(post.id)) return;
        impressionSentRef.current.add(post.id);
        const postId = post.id;
        const cb = () => onImpression(postId);
        if (typeof requestIdleCallback !== 'undefined') {
          (requestIdleCallback as typeof requestIdleCallback)(cb, { timeout: 500 });
        } else {
          setTimeout(cb, 100);
        }
      },
      { threshold: 0.25, rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, onImpression]);

  return (
    <div
      key={`${post.id}-${index}`}
      className="feed-card"
      ref={(node) => {
        cardRef.current = node;
        if (isLastElement && lastPostElementRef) lastPostElementRef(node);
      }}
      style={{ borderBottom: '1px solid #6b6b6b', position: 'relative' }}
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
          <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '6px', color: '#111111' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#111111' }}>
              {post.profiles?.username?.toLowerCase() === 'guest user' ? 'User' : (post.profiles?.username || 'User')}
            </span>
            {status.isOnline ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{ ...commonStyles.onlineIndicator, width: '11px', height: '11px', marginTop: '2px' }}></div>
                <span style={{ fontSize: '13px', color: '#31a24c', fontWeight: 'normal' }}>{statusLabel}</span>
              </div>
            ) : (
              statusLabel && (
                <span style={{ fontSize: '13px', color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>
                  {statusLabel}
                </span>
              )
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#4a4d52', lineHeight: '18px', marginTop: '0px' }}>
            {post.is_boosted ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#4a4d52' }}>
                <span style={{ color: '#4a4d52' }}>{formatTime(post.created_at)}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#4a4d52',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ color: '#4a4d52' }}>{post.province}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#4a4d52',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#4a4d52' }}>Ad</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#4a4d52' }}>
                <span style={{ color: '#4a4d52' }}>{formatTime(post.created_at)}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#4a4d52',
                    margin: '0 6px',
                    transform: 'translateY(1px)',
                  }}
                />
                <span style={{ color: '#4a4d52' }}>{post.province}</span>
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
            onDeletePost={onDeletePost}
            onReport={onReport}
            onSetActiveMenu={onSetActiveMenu}
            onSetMenuAnimating={onSetMenuAnimating}
          />
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap', color: '#111111', fontWeight: 500 }}>
        {post.caption}
      </div>

      {/* Photo Grid — priority = โพสแรกในฟีด เพื่อ LCP */}
      <PhotoGrid images={post.images || []} onPostClick={(imageIndex) => onViewPost(post, imageIndex)} priority={priority} />

      {/* Post Actions */}
      <div style={{ borderTop: '1px solid #f0f2f5' }}>
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            {/* Like Button */}
            <div 
              onClick={() => onViewLikes?.(post.id)} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '999px',
                minHeight: '34px',
              }}
            >
              <svg 
                width="22" 
                height="22" 
                viewBox="0 0 24 24" 
                className={justLikedPosts[post.id] ? "animate-pop" : ""} 
                fill={likedPosts[post.id] ? "#e0245e" : "none"} 
                stroke={likedPosts[post.id] ? "#e0245e" : "#4a4d52"} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(post.id);
                }}
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#4a4d52' }}>
                {formatCompactNumber(post.likes || 0)}
              </span>
            </div>

            {/* Save Button */}
            <div 
              onClick={() => onViewSaves?.(post.id)} 
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '999px',
                minHeight: '34px',
              }}
            >
              <svg 
                width="22" 
                height="22" 
                viewBox="0 0 24 24" 
                className={justSavedPosts[post.id] ? "animate-pop" : ""} 
                fill={savedPosts[post.id] ? "#FFD700" : "none"} 
                stroke={savedPosts[post.id] ? "#FFD700" : "#4a4d52"} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(post.id);
                }}
              >
                <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#4a4d52' }}>
                {formatCompactNumber(post.saves || 0)}
              </span>
            </div>

            {/* View Count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#4a4d52',
                padding: '6px 10px',
                borderRadius: '999px',
                minHeight: '34px',
              }}
            >
              <svg 
                width="22" 
                height="22" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#4a4d52" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111111' }}>
                {formatCompactNumber(post.views || 0)}
              </span>
            </div>

            {/* Share Button */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onShare(post);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '999px',
                minHeight: '34px',
              }}
            >
              <ShareIconTraced size={22} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4a4d52' }}>
                {formatCompactNumber(post.shares || 0)}
              </span>
            </div>

          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
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
                {isSoldPost ? 'ຂາຍແລ້ວ' : 'ຍ້າຍໄປຂາຍແລ້ວ'}
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
                  return (
                <a 
                  href={`https://wa.me/${digits}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#25D366', 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    textDecoration: 'none', 
                    color: '#fff', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                  }}
                >
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
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
              ລົດຄັນນີ້ຖືກຂາຍແລ້ວບໍ?
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
                  await onTogglePostStatus(post.id, post.status);
                  setIsTogglingStatus(false);
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
              ລົດຄັນນີ້ຖືກຂາຍແລ້ວ
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
    </div>
  );
});

PostCard.displayName = 'PostCard';
