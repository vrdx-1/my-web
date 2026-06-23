'use client'

import React from 'react';
import { Avatar } from './Avatar';
import { PostCardMenu } from './PostCardMenu';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { commonStyles } from '@/utils/commonStyles';
import { formatTime } from '@/utils/postUtils';

interface PostCardHeaderProps {
  post: any;
  session: any;
  activeProfileId: string;
  isOwner: boolean;
  hideBoost: boolean;
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  showMenuButton: boolean;
  onProfileClick?: (post: any) => void;
  onSave: (postId: string) => void;
  onMenuSave?: (postId: string) => void;
  menuSaveLabel?: string;
  onShare: (post: any) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onRepost?: (postId: string, options?: { silentSuccessPopup?: boolean }) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  onBoostClick: () => void;
  canQuickRepost: boolean;
  isQuickReposting: boolean;
  onHandleQuickRepost: () => Promise<void>;
  leftOfAvatar?: React.ReactNode;
  /** true = โหลด avatar แบบ eager (สำหรับการ์ดบนสุด above the fold เพื่อ LCP) */
  eagerAvatar?: boolean;
}

export function PostCardHeader({
  post,
  session,
  activeProfileId,
  isOwner,
  hideBoost,
  activeMenuState,
  isMenuAnimating,
  menuButtonRefs,
  showMenuButton,
  onProfileClick,
  onSave,
  onMenuSave,
  menuSaveLabel,
  onShare,
  onDeletePost,
  onReport,
  onRepost,
  onSetActiveMenu,
  onSetMenuAnimating,
  onBoostClick,
  canQuickRepost,
  isQuickReposting,
  onHandleQuickRepost,
  leftOfAvatar,
  eagerAvatar = false,
}: PostCardHeaderProps) {
  return (
    <div style={{ ...commonStyles.postHeader, gap: '10px' }}>
      {leftOfAvatar && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {leftOfAvatar}
        </div>
      )}
      <div
        style={{ position: 'relative', cursor: onProfileClick ? 'pointer' : 'default' }}
        onClick={(e) => {
          if (!onProfileClick) return;
          e.stopPropagation();
          onProfileClick(post);
        }}
      >
        <Avatar avatarUrl={post.profiles?.avatar_url} size={40} session={session} useProfileImage eager={eagerAvatar} />
      </div>
      <div style={{ flex: 1, minWidth: 0, marginTop: '2px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '3px', color: '#111111' }}>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              color: '#111111',
              cursor: onProfileClick ? 'pointer' : 'default',
            }}
            onClick={(e) => {
              if (!onProfileClick) return;
              e.stopPropagation();
              onProfileClick(post);
            }}
          >
            {post.profiles?.username || 'Unknown user'}
          </span>
          {post.profiles?.is_verified && (
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-label="Verified">
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
              <span style={{ display: 'inline-block', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#9ea2a7', margin: '0 6px', transform: 'translateY(1px)' }} />
              <span style={{ color: '#4a4d52' }}>{post.province}</span>
              <span style={{ display: 'inline-block', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#9ea2a7', margin: '0 6px', transform: 'translateY(1px)' }} />
              <span style={{ fontSize: '13px', color: '#4a4d52' }}>Ad</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#4a4d52', flexWrap: 'wrap' }}>
              <span style={{ color: '#4a4d52' }}>{formatTime(post.created_at)}</span>
              <span style={{ display: 'inline-block', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#9ea2a7', margin: '0 6px', transform: 'translateY(1px)' }} />
              <span style={{ color: '#4a4d52' }}>{post.province}</span>
            </span>
          )}
        </div>
      </div>

      {showMenuButton && (
        <div style={{ marginTop: '-2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
          {canQuickRepost && (
            <button
              type="button"
              onClick={onHandleQuickRepost}
              disabled={isQuickReposting}
              aria-label="ໂພສໃໝ່"
              title="ໂພສໃໝ່"
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                cursor: isQuickReposting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ea2a7',
                opacity: isQuickReposting ? 0.65 : 1,
                touchAction: 'manipulation',
              }}
            >
              {isQuickReposting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ButtonSpinner />
                </span>
              ) : (
                <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </span>
              )}
            </button>
          )}

          <PostCardMenu
            post={post}
            session={session}
            activeProfileId={activeProfileId}
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
            onBoostClick={onBoostClick}
          />
        </div>
      )}
    </div>
  );
}
