'use client'

import React, { useEffect, useState } from 'react';
import { Avatar } from '../Avatar';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';

interface ViewingPostModalProps {
  viewingPost: any | null;
  session: any;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  viewingModeIsDragging: boolean;
  savedScrollPosition: number;
  onClose: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onImageClick: (images: string[], index: number) => void;
}

export const ViewingPostModal = React.memo<ViewingPostModalProps>(({
  viewingPost,
  session,
  isViewingModeOpen,
  viewingModeDragOffset,
  viewingModeIsDragging,
  savedScrollPosition,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onImageClick,
}) => {
  if (!viewingPost) return null;

  const status = getOnlineStatus(viewingPost.profiles?.last_seen);
  const [enterPhase, setEnterPhase] = useState<'offscreen' | 'animating' | 'entered'>('offscreen');

  // Slide-in only when opening. Closing remains instant (unmount).
  useEffect(() => {
    setEnterPhase('offscreen');
  }, [viewingPost?.id]);

  useEffect(() => {
    if (!isViewingModeOpen) return;
    if (enterPhase !== 'offscreen') return;

    setEnterPhase('animating');
    const t = window.setTimeout(() => {
      setEnterPhase('entered');
    }, 220);

    return () => window.clearTimeout(t);
  }, [isViewingModeOpen, enterPhase]);

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: '#fff', 
        zIndex: 2000, 
        transform: `translateX(calc(${enterPhase === 'offscreen' ? '100vw' : '0px'} + ${viewingModeDragOffset}px))`,
        transition: enterPhase === 'animating' ? 'transform 220ms ease-out' : 'none',
      }} 
      onTouchStart={onTouchStart} 
      onTouchMove={onTouchMove} 
      onTouchEnd={onTouchEnd}
    >
      <div 
        id="viewing-mode-container" 
        style={{ 
          width: '100%', 
          height: '100%', 
          background: '#fff', 
          position: 'relative', 
          overflowY: 'auto',
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'auto',
        }}
      >
        <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 2001 }}>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '8px', 
              touchAction: 'manipulation' 
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <Avatar avatarUrl={viewingPost.profiles?.avatar_url} size={38} session={session} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {viewingPost.profiles?.username || 'User'}
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
              {viewingPost.is_boosted ? (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#4a4d52' }}>• Ad</span> 
                  <span style={{ marginLeft: '4px' }}>{formatTime(viewingPost.created_at)}</span>
                  <span style={{ margin: '0 4px' }}>•</span>
                  {viewingPost.province}
                </span>
              ) : (
                <>{formatTime(viewingPost.created_at)} · {viewingPost.province}</>
              )}
            </div>
          </div>
        </div>
        {viewingPost.images.map((img: string, idx: number) => (
          <div 
            key={idx} 
            id={`viewing-image-${idx}`} 
            style={{ 
              position: 'relative', 
              background: '#fff', 
              marginBottom: '12px', 
              width: '100vw', 
              left: '50%', 
              right: '50%', 
              marginLeft: '-50vw', 
              marginRight: '-50vw' 
            }}
          >
            <div style={{ width: '100%', overflow: 'hidden', padding: 0, margin: 0 }}>
              <img 
                src={img} 
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onClick={() => onImageClick(viewingPost.images, idx)} 
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  display: 'block', 
                  cursor: 'pointer', 
                  margin: 0, 
                  padding: 0 
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ViewingPostModal.displayName = 'ViewingPostModal';
