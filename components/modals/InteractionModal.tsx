'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../Avatar';
import { LoadingSpinner } from '../LoadingSpinner';
import { EmptyState } from '../EmptyState';
import { GuestAvatarIcon } from '../GuestAvatarIcon';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';

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
  const shouldHide = !show || !postId;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show && !shouldHide) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [show, shouldHide]);

  // Lazy load รายชื่อใน bottom sheet ให้ใช้ pattern เดียวกับ feed หน้า Home
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [localLoadingMore, setLocalLoadingMore] = useState<boolean>(false);

  // รีเซ็ตจำนวนที่แสดงเมื่อโพสต์หรือประเภทเปลี่ยน หรือจำนวนผู้ใช้เปลี่ยน
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [postId, type, interactionUsers.length]);

  const hasMore = useMemo(
    () => visibleCount < interactionUsers.length,
    [visibleCount, interactionUsers.length]
  );

  const { lastElementRef } = useInfiniteScroll({
    loadingMore: localLoadingMore,
    hasMore,
    onLoadMore: () => {
      if (localLoadingMore) return;
      if (!hasMore) return;
      setLocalLoadingMore(true);
      setVisibleCount(prev =>
        Math.min(prev + PREFETCH_COUNT, interactionUsers.length)
      );
      setLocalLoadingMore(false);
    },
    threshold: 0.2,
  });

  const visibleUsers = useMemo(
    () => interactionUsers.slice(0, visibleCount),
    [interactionUsers, visibleCount]
  );

  if (shouldHide) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.6)', 
        zIndex: 10000, 
        display: 'flex', 
        alignItems: 'flex-end', 
        transition: 'background 0.3s', 
        touchAction: 'none', 
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }} 
      onClick={onClose}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
      }}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '100%', 
          background: '#fff', 
          borderRadius: interactionSheetMode === 'full' ? '0' : '20px 20px 0 0', 
          height: interactionSheetMode === 'full' ? '100%' : '70%', 
          transform: isInteractionModalAnimating ? 'translateY(100%)' : 'translateY(0)', 
          transition: 'transform 0.3s ease-out', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          touchAction: 'auto' 
        }}
      >
        {/* Drag handle และ header section - ใช้ touch handler เพื่อขยาย/ย่อ bottom sheet */}
        <div 
          onTouchStart={onSheetTouchStart} 
          onTouchMove={onSheetTouchMove} 
          onTouchEnd={onSheetTouchEnd}
          style={{ flexShrink: 0 }}
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
        </div>
        {/* Scrollable content area - ไม่มี touch handler เพื่อป้องกันการขยาย bottom sheet ตอน scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {interactionLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <LoadingSpinner />
            </div>
          ) : visibleUsers.length > 0 ? (
            visibleUsers.map((u, i) => {
              const isLast = i === visibleUsers.length - 1;
              return (
              <div
                key={i}
                ref={isLast ? lastElementRef : undefined}
                style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                {u.avatar_url ? (
                  <Avatar avatarUrl={u.avatar_url} size={40} session={null} />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#e4e6eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <GuestAvatarIcon size={18} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.username}
                  </div>
                </div>
              </div>
            );})
          ) : (
            <EmptyState message="ບໍ່ມີລາຍຊື່" variant="minimal" />
          )}
        </div>
      </div>
    </div>
  );
});

InteractionModal.displayName = 'InteractionModal';
