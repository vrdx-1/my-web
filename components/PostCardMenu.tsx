'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MenuDropdown } from './MenuDropdown';

interface PostCardMenuProps {
  post: any;
  isOwner: boolean;
  hideBoost: boolean;
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onSave: (postId: string) => void;
  saveLabel?: string;
  onShare: (post: any) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  onOpenPrivateNote?: (post: any) => void;
  onRepost?: (postId: string) => void | Promise<void>;
}

export const PostCardMenu = React.memo<PostCardMenuProps>(({
  post,
  isOwner,
  hideBoost,
  activeMenuState,
  isMenuAnimating,
  menuButtonRefs,
  onSave,
  saveLabel,
  onShare,
  onDeletePost,
  onReport,
  onSetActiveMenu,
  onSetMenuAnimating,
  onOpenPrivateNote,
  onRepost,
}) => {
  const router = useRouter();
  const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
  const postCreatedAt = new Date(post.created_at).getTime();
  const canRepost = Number.isFinite(postCreatedAt) && Date.now() - postCreatedAt >= SIX_DAYS_MS;
  const [showRepostConfirm, setShowRepostConfirm] = React.useState(false);
  const [isReposting, setIsReposting] = React.useState(false);

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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ea2a7">
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
            onSave={() => {
              onSetActiveMenu(null);
              onSave(post.id);
            }}
            saveLabel={saveLabel}
            onShare={() => {
              onSetActiveMenu(null);
              onShare(post);
            }}
            onBoost={
              hideBoost
                ? undefined
                : () => {
                    onSetActiveMenu(null);
                    router.push(`/boost_post?id=${post.id}`);
                  }
            }
            onReport={() => {
              onSetActiveMenu(null);
              onReport(post);
            }}
            onPrivateNote={
              isOwner
                ? () => {
                    onSetActiveMenu(null);
                    onOpenPrivateNote?.();
                  }
                : undefined
            }
            onRepost={
              isOwner && canRepost && typeof onRepost === 'function'
                ? () => {
                    onSetActiveMenu(null);
                    setShowRepostConfirm(true);
                  }
                : undefined
            }
          />
        );
      })()}

      {typeof document !== 'undefined' && showRepostConfirm && createPortal(
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
              ຢືນຢັນການໂພສໃໝ່?
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setShowRepostConfirm(false)}
                disabled={isReposting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: isReposting ? 'not-allowed' : 'pointer',
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (typeof onRepost !== 'function') return;
                  setIsReposting(true);
                  try {
                    await onRepost(post.id);
                    setShowRepostConfirm(false);
                  } finally {
                    setIsReposting(false);
                  }
                }}
                disabled={isReposting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: isReposting ? 'not-allowed' : 'pointer',
                  opacity: isReposting ? 0.6 : 1,
                }}
              >
                {isReposting ? 'ກຳລັງໂພສໃໝ່...' : 'ຢືນຢັນ'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

PostCardMenu.displayName = 'PostCardMenu';

