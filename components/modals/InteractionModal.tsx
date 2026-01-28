'use client'

import React from 'react';
import { Avatar } from '../Avatar';
import { LoadingSpinner } from '../LoadingSpinner';
import { EmptyState } from '../EmptyState';

interface InteractionModalProps {
  show: boolean;
  type: 'likes' | 'saves';
  postId: string | null;
  posts: any[];
  interactionUsers: any[];
  interactionLoading: boolean;
  interactionSheetMode: 'half' | 'full' | 'hidden';
  isInteractionModalAnimating: boolean;
  startY: number;
  currentY: number;
  onClose: () => void;
  onSheetTouchStart: (e: React.TouchEvent) => void;
  onSheetTouchMove: (e: React.TouchEvent) => void;
  onSheetTouchEnd: () => void;
  onFetchInteractions: (type: 'likes' | 'saves', postId: string) => void;
}

export const InteractionModal = React.memo<InteractionModalProps>(({
  show,
  type,
  postId,
  posts,
  interactionUsers,
  interactionLoading,
  interactionSheetMode,
  isInteractionModalAnimating,
  startY,
  currentY,
  onClose,
  onSheetTouchStart,
  onSheetTouchMove,
  onSheetTouchEnd,
  onFetchInteractions,
}) => {
  if (!show || !postId) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: interactionSheetMode === 'full' ? '#fff' : 'rgba(0,0,0,0.5)', 
        zIndex: 10000, 
        display: 'flex', 
        alignItems: 'flex-end', 
        transition: 'background 0.3s', 
        touchAction: 'none', 
        overflow: 'hidden' 
      }} 
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        onTouchStart={onSheetTouchStart} 
        onTouchMove={onSheetTouchMove} 
        onTouchEnd={onSheetTouchEnd} 
        style={{ 
          width: '100%', 
          background: '#fff', 
          borderRadius: interactionSheetMode === 'full' ? '0' : '20px 20px 0 0', 
          height: interactionSheetMode === 'full' ? 'calc(100% - 110px)' : '70%', 
          transform: isInteractionModalAnimating ? 'translateY(100%)' : 'translateY(0)', 
          transition: 'transform 0.3s ease-out', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          touchAction: 'auto' 
        }}
      >
        <div 
          onClick={onClose} 
          style={{ 
            padding: '8px 0', 
            display: 'flex', 
            justifyContent: 'center', 
            cursor: 'pointer' 
          }}
        >
          <div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div>
        </div>
        <div style={{ position: 'sticky', display: 'flex', alignItems: 'center', gap: '40px', padding: '6px 25px 0px 25px', top: 0, background: '#fff', zIndex: 10 }}>
          <div 
            onClick={() => onFetchInteractions('likes', postId)} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              cursor: 'pointer', 
              width: 'fit-content' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={type === 'likes' ? "#e0245e" : "none"} stroke={type === 'likes' ? "#e0245e" : "#4a4d52"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>
              </svg>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: type === 'likes' ? '#e0245e' : '#4a4d52' }}>
                {posts.find(p => p.id === postId)?.likes || 0}
              </span>
            </div>
            <div style={{ width: '100%', height: '3px', background: type === 'likes' ? '#e0245e' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
          </div>
          <div 
            onClick={() => onFetchInteractions('saves', postId)} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              cursor: 'pointer', 
              width: 'fit-content' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={type === 'saves' ? "#FFD700" : "none"} stroke={type === 'saves' ? "#FFD700" : "#4a4d52"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path>
              </svg>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: type === 'saves' ? '#FFD700' : '#4a4d52' }}>
                {posts.find(p => p.id === postId)?.saves || 0}
              </span>
            </div>
            <div style={{ width: '100%', height: '3px', background: type === 'saves' ? '#FFD700' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
          </div>
          <div style={{ position: 'absolute', bottom: '0px', left: 0, right: 0, height: '1px', background: '#f0f0f0' }}></div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {interactionLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <LoadingSpinner />
            </div>
          ) : interactionUsers.length > 0 ? (
            interactionUsers.map((u, i) => (
              <div key={i} style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar avatarUrl={u.avatar_url} size={40} session={null} />
                <div style={{ fontWeight: '600', color: u.username === 'User' ? '#888' : '#000' }}>{u.username}</div>
              </div>
            ))
          ) : (
            <EmptyState message="ບໍ່ມີລາຍຊື່" variant="minimal" />
          )}
        </div>
      </div>
    </div>
  );
});

InteractionModal.displayName = 'InteractionModal';
