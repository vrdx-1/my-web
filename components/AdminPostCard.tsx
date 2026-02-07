'use client'

import React from 'react';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { formatCompactNumber } from '@/utils/currency';

interface AdminPostCardProps {
  post: any;
  index: number;
  session?: any;
  onViewPost?: (post: any) => void;
  adminActions?: React.ReactNode; // Custom admin actions (Hide, Remove, etc.)
  showStats?: boolean; // Show likes, views, saves, shares
  className?: string;
}

/**
 * AdminPostCard Component
 * Simplified version of PostCard for admin pages
 * Shows post feed with optional admin controls
 */
export const AdminPostCard = React.memo<AdminPostCardProps>(({
  post,
  index,
  session,
  onViewPost,
  adminActions,
  showStats = true,
  className = '',
}) => {
  const status = getOnlineStatus(post.profiles?.last_seen);

  return (
    <div 
      className={className}
      style={{ 
        background: '#fff', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        marginBottom: '15px'
      }}
    >
      {/* Post Header */}
      <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
          <Avatar avatarUrl={post.profiles?.avatar_url} size={40} session={session} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px', color: '#111111' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {post.profiles?.username || 'User'}
            </span>
            {status.isOnline ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
                <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
              </div>
            ) : (
              status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>{status.text}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#4a4d52', lineHeight: '16px' }}>
            {formatTime(post.created_at)} · {post.province}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap', color: '#111111' }}>
        {post.caption}
      </div>

      {/* Media */}
      <div onClick={() => onViewPost?.(post)}>
        <PhotoGrid images={post.images || []} onPostClick={() => onViewPost?.(post)} />
      </div>

      {/* Stats Bar */}
      {showStats && (
        <div style={{ borderTop: '1px solid #f0f2f5', padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111111' }}>{formatCompactNumber(post.likes || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#111111' }}>{formatCompactNumber(post.views || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111111' }}>{formatCompactNumber(post.saves || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: '#4a4d52' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: '600', marginLeft: '4px', color: '#111111' }}>{formatCompactNumber(post.shares || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AdminPostCard.displayName = 'AdminPostCard';
