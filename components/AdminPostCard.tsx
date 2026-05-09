'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Avatar } from './Avatar';
import { PhotoGrid } from './PhotoGrid';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { formatTime } from '@/utils/postUtils';
import { formatCompactNumber } from '@/utils/currency';

interface AdminPostCardProps {
  post: any;
  index: number;
  session?: any;
  onViewPost?: (post: any) => void;
  adminActions?: React.ReactNode; // Custom admin actions (Hide, Remove, etc.)
  showStats?: boolean; // Show likes and shares
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
  const rawPrice = post?.price;
  const priceValue = typeof rawPrice === 'number'
    ? (Number.isFinite(rawPrice) ? rawPrice : null)
    : typeof rawPrice === 'string'
      ? (() => {
          const digitsOnly = rawPrice.replace(/\D/g, '');
          if (!digitsOnly) return null;
          const parsed = Number(digitsOnly);
          return Number.isFinite(parsed) ? parsed : null;
        })()
      : null;

  const currencySymbol = post?.price_currency === '฿' || post?.price_currency === '$'
    ? post.price_currency
    : '₭';
  const priceText = priceValue && priceValue > 0
    ? `${priceValue.toLocaleString('en-US')} ${currencySymbol}`
    : 'ບໍ່ລະບຸລາຄາ';

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
<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#111111' }}>
            {post.profiles?.username?.toLowerCase() === 'guest user' ? 'User' : (post.profiles?.username || 'User')}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#4a4d52', lineHeight: '18px' }}>
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
          </div>
        </div>
        {adminActions ? <div style={{ marginLeft: 'auto' }}>{adminActions}</div> : null}
      </div>

      {/* Caption */}
      {post.caption ? (
        <div style={{ padding: '0 15px 8px 15px', fontSize: '15px', lineHeight: '21px', whiteSpace: 'pre-wrap', color: '#111111', fontWeight: 500 }}>
          {post.caption}
        </div>
      ) : null}

      {/* Media */}
      <div onClick={() => onViewPost?.(post)}>
        <PhotoGrid
          images={post.images || []}
          onPostClick={() => onViewPost?.(post)}
          layout={post.layout || 'default'}
          gap={PHOTO_GRID_GAP}
        />
      </div>

      {/* Stats Bar */}
      <div style={{ borderTop: '1px solid #f0f2f5', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
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
              fontSize: '14px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <span style={{ color: '#1c1e21', fontSize: '16px', lineHeight: '21px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {priceText}
            </span>
          </span>
        </div>

        {showStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a4d52' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{formatCompactNumber(post.likes || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a4d52' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{formatCompactNumber(post.shares || 0)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

AdminPostCard.displayName = 'AdminPostCard';
