'use client'

import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { PostActions } from './PostActions';
import { MenuDropdown } from './MenuDropdown';
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
  onTogglePostStatus: (postId: string, currentStatus: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
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
}) => {
  const router = useRouter();
  const status = getOnlineStatus(post.profiles?.last_seen);
  const isOwner = isPostOwner(post, session);

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

  return (
    <div 
      key={`${post.id}-${index}`} 
      ref={isLastElement ? lastPostElementRef : undefined} 
      style={{ borderBottom: '8px solid #d1d5db', position: 'relative' }}
    >
      {/* Post Header */}
      <div style={commonStyles.postHeader}>
        <div style={{ position: 'relative' }}>
          <Avatar avatarUrl={post.profiles?.avatar_url} size={40} session={session} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {post.profiles?.username || 'User'}
            {status.isOnline ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={commonStyles.onlineIndicator}></div>
                <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
              </div>
            ) : (
              status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>
            {post.is_boosted ? (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#65676b' }}>• Ad</span> 
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
        <div style={{ position: 'relative', marginTop: '-4px' }}>
          <button 
            ref={(el) => { menuButtonRefs.current[post.id] = el; }} 
            data-menu-button 
            onClick={handleMenuClick}
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: '8px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              touchAction: 'manipulation' 
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b">
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
                onBoost={() => {
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
      <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
        {post.caption}
      </div>

      {/* Photo Grid */}
      <PhotoGrid images={post.images || []} onPostClick={(imageIndex) => onViewPost(post, imageIndex)} />

      {/* Post Actions */}
      <PostActions
        post={post}
        likedPosts={likedPosts}
        savedPosts={savedPosts}
        justLikedPosts={justLikedPosts}
        justSavedPosts={justSavedPosts}
        onLike={onLike}
        onSave={onSave}
        onShare={onShare}
        onViewLikes={onViewLikes}
        onViewSaves={onViewSaves}
      />

      {/* Action Buttons */}
      <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {isOwner ? (
          <button 
            onClick={() => onTogglePostStatus(post.id, post.status)} 
            style={{ 
              background: '#ff0000', 
              padding: '6px 16px', 
              borderRadius: '999px', 
              border: 'none', 
              color: '#fff', 
              fontWeight: 'bold', 
              fontSize: '13px', 
              cursor: 'pointer' 
            }}
          >
            ຍ້າຍໄປຂາຍແລ້ວ
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
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                textDecoration: 'none', 
                color: '#fff', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
              }}
            >
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>
          )
        )}
      </div>
    </div>
  );
});

PostCard.displayName = 'PostCard';
