'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { MenuDropdown } from './MenuDropdown';
import { ShareIconTraced } from './icons/ShareIconTraced';
import { formatTime, getOnlineStatus, isPostOwner } from '@/utils/postUtils';
import { commonStyles } from '@/utils/commonStyles';

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
}) => {
  const router = useRouter();
  const status = getOnlineStatus(post.profiles?.last_seen);
  const isOwner = isPostOwner(post, session);
  const isSoldPost = post.status === 'sold';
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = React.useState(false);
  const [showSoldInfo, setShowSoldInfo] = React.useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const impressionSentRef = React.useRef<Set<string>>(new Set());

  // Close popups on scroll (feed scroll)
  React.useEffect(() => {
    if (!showMarkSoldConfirm && !showSoldInfo) return;
    const handleScroll = () => {
      setShowMarkSoldConfirm(false);
      setShowSoldInfo(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showMarkSoldConfirm, showSoldInfo]);

  const handleMenuClick = () => {
    if (activeMenuState === post.id) {
      onSetMenuAnimating(true);
      setTimeout(() => {
        onSetActiveMenu(null);
        onSetMenuAnimating(false);
      }, 300);
    } else {
      onSetActiveMenu(post.id);
      onSetMenuAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onSetMenuAnimating(false);
        });
      });
    }
  };

  const handleMenuClose = () => {
    onSetMenuAnimating(true);
    setTimeout(() => {
      onSetActiveMenu(null);
      onSetMenuAnimating(false);
    }, 300);
  };

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el || !onImpression) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || impressionSentRef.current.has(post.id)) return;
        impressionSentRef.current.add(post.id);
        onImpression(post.id);
      },
      { threshold: 0.25, rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, onImpression]);

  return (
    <div
      key={`${post.id}-${index}`}
      ref={(node) => {
        cardRef.current = node;
        if (isLastElement && lastPostElementRef) lastPostElementRef(node);
      }}
      style={{ borderBottom: '8px solid #d1d5db', position: 'relative' }}
    >
      {/* Post Header */}
      <div style={{ ...commonStyles.postHeader, gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <Avatar avatarUrl={post.profiles?.avatar_url} size={36} session={session} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px', color: '#111111' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {post.profiles?.username || 'User'}
            </span>
            {status.isOnline ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{ ...commonStyles.onlineIndicator, width: '10px', height: '10px' }}></div>
                <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
              </div>
            ) : (
              status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>{status.text}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#4a4d52', lineHeight: '18px', marginTop: '0px' }}>
            {post.is_boosted ? (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#4a4d52' }}>• Ad</span> 
                <span style={{ marginLeft: '4px' }}>{formatTime(post.created_at)}</span>
                <span style={{ margin: '0 4px' }}>•</span>
                {post.province}
              </span>
            ) : (
              <>{formatTime(post.created_at)} · {post.province}</>
            )}
          </div>
        </div>
        
        {/* Menu Button */}
        <div style={{ position: 'relative' }}>
          <button 
            ref={(el) => { menuButtonRefs.current[post.id] = el; }} 
            data-menu-button 
            onClick={handleMenuClick}
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: '5px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              touchAction: 'manipulation' 
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#4a4d52">
              <circle cx="5" cy="12" r="2.5" />
              <circle cx="12" cy="12" r="2.5" />
              <circle cx="19" cy="12" r="2.5" />
            </svg>
          </button>
          
          {/* Menu Dropdown */}
          {activeMenuState === post.id && (() => {
            const buttonEl = menuButtonRefs.current[post.id];
            const rect = buttonEl?.getBoundingClientRect();
            const menuTop = rect ? rect.bottom + 4 : 0;
            const menuRight = rect ? window.innerWidth - rect.right : 0;
            
            return (
              <MenuDropdown
                postId={post.id}
                isOwner={isOwner}
                isOpen={activeMenuState === post.id}
                isAnimating={isMenuAnimating}
                menuTop={menuTop}
                menuRight={menuRight}
                onClose={handleMenuClose}
                onEdit={() => {
                  onSetActiveMenu(null);
                  router.push(`/edit-post/${post.id}`);
                }}
                onDelete={() => {
                  onSetActiveMenu(null);
                  onDeletePost(post.id);
                }}
                onBoost={hideBoost ? undefined : () => {
                  onSetActiveMenu(null);
                  router.push(`/boost_post?id=${post.id}`);
                }}
                onReport={() => {
                  onSetActiveMenu(null);
                  onReport(post);
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap', color: '#111111', fontWeight: 500 }}>
        {post.caption}
      </div>

      {/* Photo Grid */}
      <PhotoGrid images={post.images || []} onPostClick={(imageIndex) => onViewPost(post, imageIndex)} />

      {/* Post Actions */}
      <div style={{ borderTop: '1px solid #f0f2f5' }}>
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {/* Like Button */}
            <div 
              onClick={() => onViewLikes?.(post.id)} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '3px 6px', borderRadius: '4px', minHeight: '26px' }}
            >
              <svg 
                width="18" 
                height="18" 
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
              <span style={{ fontSize: '12px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#4a4d52' }}>
                {post.likes || 0}
              </span>
            </div>

            {/* Save Button */}
            <div 
              onClick={() => onViewSaves?.(post.id)} 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', borderRadius: '4px', minHeight: '26px' }}
            >
              <svg 
                width="18" 
                height="18" 
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
              <span style={{ fontSize: '12px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#4a4d52' }}>
                {post.saves || 0}
              </span>
            </div>

            {/* View Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52', padding: '3px 6px', borderRadius: '4px', minHeight: '26px' }}>
              <svg 
                width="18" 
                height="18" 
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
              <span style={{ fontSize: '12px', fontWeight: '600' }}>{post.views || 0}</span>
            </div>

            {/* Share Button */}
            <div 
              onClick={() => onShare(post)} 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '4px', minHeight: '26px', marginLeft: '-12px', marginTop: '-4px' }}
            >
              <ShareIconTraced size={32} style={{ color: '#4a4d52' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#4a4d52', marginLeft: '-5px', marginTop: '3px' }}>{post.shares || 0}</span>
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
                  background: isSoldPost ? '#e4e6eb' : '#e0245e', 
                  padding: '3px 10px', 
                  minHeight: '26px',
                  lineHeight: '18px',
                  borderRadius: '6px', 
                  border: 'none', 
                  color: isSoldPost ? '#666' : '#fff', 
                  fontWeight: 'bold', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                }}
              >
                {isSoldPost ? 'ຂາຍແລ້ວ' : 'ຍ້າຍໄປຂາຍແລ້ວ'}
              </button>
            ) : (
              post.profiles?.phone && (
                <a 
                  href={`https://wa.me/${post.profiles.phone.replace(/\+/g, '').replace(/ /g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#25D366', 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    textDecoration: 'none', 
                    color: '#fff', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                  }}
                >
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
              )
            )}
          </div>
        </div>
      </div>

      {/* Confirm Mark as Sold Modal (same design as logout confirm) */}
      {isOwner && !isSoldPost && showMarkSoldConfirm && (
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
          onClick={() => setShowMarkSoldConfirm(false)}
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
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
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
                    <style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.loading-spinner-circle-btn { display: inline-block; width: 20px; height: 20px; position: relative; }
.loading-spinner-circle-btn div { position: absolute; width: 4px; height: 4px; border-radius: 50%; top: 0; left: 50%; margin-left: -2px; transform-origin: 2px 10px; background: currentColor; animation: fadeColor 1s linear infinite; opacity: 0.8; }
.loading-spinner-circle-btn div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.loading-spinner-circle-btn div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.loading-spinner-circle-btn div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.loading-spinner-circle-btn div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.loading-spinner-circle-btn div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.loading-spinner-circle-btn div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.loading-spinner-circle-btn div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.loading-spinner-circle-btn div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
`}</style>
                    <span className="loading-spinner-circle-btn"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></span>
                  </span>
                ) : 'ຂາຍແລ້ວ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sold Info Modal (same design size as logout confirm) */}
      {isOwner && isSoldPost && showSoldInfo && (
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
          onClick={() => setShowSoldInfo(false)}
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
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
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
        </div>
      )}
    </div>
  );
});

PostCard.displayName = 'PostCard';
