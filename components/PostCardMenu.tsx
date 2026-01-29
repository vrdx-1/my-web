'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { MenuDropdown } from './MenuDropdown';

interface PostCardMenuProps {
  post: any;
  isOwner: boolean;
  hideBoost: boolean;
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
}

export const PostCardMenu = React.memo<PostCardMenuProps>(({
  post,
  isOwner,
  hideBoost,
  activeMenuState,
  isMenuAnimating,
  menuButtonRefs,
  onDeletePost,
  onReport,
  onSetActiveMenu,
  onSetMenuAnimating,
}) => {
  const router = useRouter();

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
    <div style={{ position: 'relative' }}>
      <button 
        ref={(el) => { menuButtonRefs.current[post.id] = el; }} 
        data-menu-button 
        onClick={handleMenuClick}
        style={{ 
          background: 'none', 
          border: 'none', 
          padding: '6px', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          touchAction: 'manipulation' 
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#4a4d52">
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
  );
});

PostCardMenu.displayName = 'PostCardMenu';

