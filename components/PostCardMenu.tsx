'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { useRouter } from 'next/navigation';
import { MenuDropdown } from './MenuDropdown';
import { RepostConfirmModal } from './RepostConfirmModal';
import { SuccessPopup } from './modals/SuccessPopup';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { mergeHeaders } from '@/utils/activeProfile';
import { supabase } from '@/lib/supabase';

interface PostCardMenuProps {
  post: any;
  session: any;
  activeProfileId?: string | null;
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
  onRepost?: (postId: string) => void | Promise<void>;
  onBoostClick?: (postId: string) => void | Promise<void>;
}

export const PostCardMenu = React.memo<PostCardMenuProps>(({
  post,
  session,
  activeProfileId,
  isOwner,
  hideBoost: _hideBoost,
  activeMenuState: _activeMenuState,
  isMenuAnimating: _isMenuAnimating,
  menuButtonRefs,
  onSave,
  saveLabel,
  onShare,
  onDeletePost,
  onReport,
  onSetActiveMenu: _onSetActiveMenu,
  onSetMenuAnimating: _onSetMenuAnimating,
  onRepost,
  onBoostClick: _onBoostClick,
}) => {
  const router = useRouter();
  const menuInstanceId = React.useId();
  const isRecommendPost = post.status === 'recommend';
  const canRepost = isOwner && isRecommendPost && typeof onRepost === 'function';
  const [showRepostConfirm, setShowRepostConfirm] = React.useState(false);
  const [isReposting, setIsReposting] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isMenuOpen || typeof window === 'undefined') return;

    const closeMenuOnScroll = () => {
      setIsMenuOpen(false);
    };

    window.addEventListener('scroll', closeMenuOnScroll, { passive: true });
    window.addEventListener('touchmove', closeMenuOnScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', closeMenuOnScroll);
      window.removeEventListener('touchmove', closeMenuOnScroll);
    };
  }, [isMenuOpen]);

  const handleMenuClick = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  const trackCompareUsage = React.useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token || '';

      const response = await fetch('/api/analytics/compare-click', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          activeProfileId,
        ),
        body: JSON.stringify({ post_id: post.id }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        console.warn('[compare-usage] request failed', {
          status: response.status,
          postId: post.id,
          activeProfileId,
          payload,
        });
        return;
      }

      if (payload?.skipped) {
        console.debug('[compare-usage] skipped', {
          reason: payload?.skipped_reason || 'unknown',
          postId: post.id,
          activeProfileId,
          payload,
        });
        return;
      }

      console.debug('[compare-usage] inserted', {
        postId: post.id,
        activeProfileId,
        payload,
      });
    } catch (error) {
      console.warn('[compare-usage] request error', {
        postId: post.id,
        activeProfileId,
        error,
      });
    }
  }, [activeProfileId, post.id]);

  const trackShareUsage = React.useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token || '';

      const response = await fetch('/api/analytics/share-click', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: mergeHeaders(
          {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          activeProfileId,
        ),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.warn('[share-usage] request failed', {
          status: response.status,
          postId: post.id,
          activeProfileId,
          payload,
        });
        return;
      }

      const payload = await response.json().catch(() => null);
      if (payload?.skipped) {
        console.debug('[share-usage] skipped', {
          reason: payload?.skipped || 'unknown',
          postId: post.id,
          activeProfileId,
          payload,
        });
        return;
      }

      console.debug('[share-usage] inserted', {
        postId: post.id,
        activeProfileId,
      });
    } catch (error) {
      console.warn('[share-usage] request error', {
        postId: post.id,
        activeProfileId,
        error,
      });
    }
  }, [activeProfileId, post.id]);

  return (
    <div style={{ position: 'relative' }}>
      <button 
        ref={(el) => { menuButtonRefs.current[menuInstanceId] = el; }} 
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
      {isMenuOpen && (() => {
        const buttonEl = menuButtonRefs.current[menuInstanceId];
        const rect = buttonEl?.getBoundingClientRect();
        const menuTop = rect ? rect.bottom + 4 : 0;
        const menuRight = rect ? window.innerWidth - rect.right : 0;
        
        return (
          <MenuDropdown
            postId={post.id}
            isOwner={isOwner}
            isOpen={isMenuOpen}
            isAnimating={false}
            menuTop={menuTop}
            menuRight={menuRight}
            onClose={handleMenuClose}
            onEdit={() => {
              setIsMenuOpen(false);
              router.push(`/edit-post/${post.id}`);
            }}
            onDelete={() => {
              setIsMenuOpen(false);
              onDeletePost(post.id);
            }}
            onSave={() => {
              setIsMenuOpen(false);
              if (!session) {
                router.push(REGISTER_PATH);
                return;
              }
              onSave(post.id);
            }}
            saveLabel={saveLabel}
            onShare={() => {
              setIsMenuOpen(false);
              void trackShareUsage();
              onShare(post);
            }}
            onReport={() => {
              setIsMenuOpen(false);
              onReport(post);
            }}
            onRepost={
              canRepost
                ? () => {
                    setIsMenuOpen(false);
                    setShowRepostConfirm(true);
                  }
                : undefined
            }
          />
        );
      })()}

      {canRepost && (
        <RepostConfirmModal
          isOpen={showRepostConfirm}
          isReposting={isReposting}
          onCancel={() => setShowRepostConfirm(false)}
          onConfirm={async () => {
            if (typeof onRepost !== 'function') return;
            setIsReposting(true);
            try {
              await onRepost(post.id);
              setShowRepostConfirm(false);
            } finally {
              setIsReposting(false);
            }
          }}
        />
      )}
    </div>
  );
});

PostCardMenu.displayName = 'PostCardMenu';

