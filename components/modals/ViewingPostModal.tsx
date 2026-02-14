'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Avatar } from '../Avatar';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

const VIEWING_MODE_INITIAL_VISIBLE = 3
const VIEWING_MODE_LOAD_MORE_COUNT = 2

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: '#fff', zIndex: 2000,
};
const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%', height: '100%', background: '#fff', position: 'relative',
  overflowY: 'auto', scrollBehavior: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
};
const HEADER_STYLE: React.CSSProperties = {
  padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px',
  background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 2001,
};
const BACK_BTN_STYLE: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: '8px', touchAction: 'manipulation',
};
const META_COLOR = '#4a4d52';
const DOT_STYLE: React.CSSProperties = {
  display: 'inline-block', width: 3, height: 3, borderRadius: '50%', backgroundColor: META_COLOR, margin: '0 6px', transform: 'translateY(1px)',
};
const IMAGE_WRAP_STYLE: React.CSSProperties = {
  position: 'relative', background: '#fff', marginBottom: 12, width: '100vw', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw',
};
const IMG_STYLE: React.CSSProperties = { width: '100%', height: 'auto', display: 'block', cursor: 'pointer', margin: 0, padding: 0 };

interface ViewingPostModalProps {
  viewingPost: any | null;
  session: any;
  isViewingModeOpen: boolean;
  viewingModeDragOffset: number;
  savedScrollPosition: number;
  initialImageIndex?: number;
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
  savedScrollPosition,
  initialImageIndex = 0,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onImageClick,
}) => {
  const shouldHide = !viewingPost;

  const status = getOnlineStatus(viewingPost?.profiles?.last_seen);
  const [enterPhase, setEnterPhase] = useState<'offscreen' | 'entered'>('offscreen');

  const images: string[] = Array.isArray(viewingPost?.images) ? viewingPost.images : [];

  const initialVisible = useMemo(
    () => Math.min(images.length || 0, Math.max(VIEWING_MODE_INITIAL_VISIBLE, (initialImageIndex ?? 0) + 3)),
    [initialImageIndex, images.length]
  );
  const [visibleCount, setVisibleCount] = useState<number>(() => initialVisible);
  const [localLoadingMore, setLocalLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    const next = Math.min(images.length || 0, Math.max(VIEWING_MODE_INITIAL_VISIBLE, (initialImageIndex ?? 0) + 3));
    setVisibleCount(next);
  }, [viewingPost?.id, initialImageIndex, images.length]);

  const hasMore = visibleCount < images.length;

  const onLoadMore = useCallback(() => {
    if (localLoadingMore || !hasMore) return;
    setLocalLoadingMore(true);
    setVisibleCount((prev) => Math.min(prev + VIEWING_MODE_LOAD_MORE_COUNT, images.length));
    requestAnimationFrame(() => setLocalLoadingMore(false));
  }, [localLoadingMore, hasMore, images.length]);
  const { lastElementRef } = useInfiniteScroll({
    loadingMore: localLoadingMore,
    hasMore,
    onLoadMore,
    threshold: 0.1,
    rootMargin: '200px',
  });

  const visibleImages = useMemo(
    () => images.slice(0, visibleCount),
    [images, visibleCount]
  );

  useEffect(() => {
    setEnterPhase('offscreen');
  }, [viewingPost?.id]);

  useEffect(() => {
    if (!isViewingModeOpen || enterPhase !== 'offscreen') return;
    const rafId = requestAnimationFrame(() => setEnterPhase('entered'));
    return () => cancelAnimationFrame(rafId);
  }, [isViewingModeOpen, enterPhase]);

  useEffect(() => {
    if (!viewingPost) return;
    document.body.style.overflow = 'hidden';
    document.body.style.scrollbarWidth = 'none';
    document.body.style.msOverflowStyle = 'none';
    document.body.setAttribute('data-viewing-mode', 'open');
    return () => {
      document.body.style.overflow = '';
      document.body.style.scrollbarWidth = '';
      document.body.style.msOverflowStyle = '';
      document.body.removeAttribute('data-viewing-mode');
    };
  }, [viewingPost]);

  useEffect(() => {
    if (enterPhase !== 'entered') return;
    const idx = Math.min(initialImageIndex, (images.length || 1) - 1);
    const scrollToImage = () => {
      const el = document.getElementById(`viewing-image-${idx}`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'auto' }); return true; }
      return false;
    };
    let raf1: number, raf2: number, t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (scrollToImage()) return;
        t1 = setTimeout(() => { if (!scrollToImage()) t2 = setTimeout(scrollToImage, 80); }, 50);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (t1 != null) clearTimeout(t1);
      if (t2 != null) clearTimeout(t2);
    };
  }, [enterPhase, initialImageIndex, images.length]);

  if (shouldHide) return null;

  const overlayStyle: React.CSSProperties = {
    ...OVERLAY_STYLE,
    transform: `translateX(${viewingModeDragOffset}px)`,
  };

  const metaParts = [formatTime(viewingPost.created_at), viewingPost.province];
  if (viewingPost.is_boosted) metaParts.push('Ad');

  return (
    <div style={overlayStyle} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div id="viewing-mode-container" style={CONTAINER_STYLE}>
        <div style={HEADER_STYLE}>
          <button type="button" onClick={onClose} style={BACK_BTN_STYLE} aria-label="Back">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <Avatar avatarUrl={viewingPost.profiles?.avatar_url} size={38} session={session} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: 15, lineHeight: '20px', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, color: '#111' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{viewingPost.profiles?.username || 'User'}</span>
              {status.isOnline ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }} />
                  <span style={{ fontSize: 12, color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
                </div>
              ) : status.text ? <span style={{ fontSize: 12, color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>{status.text}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: META_COLOR, lineHeight: '16px', display: 'inline-flex', alignItems: 'center' }}>
              {metaParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span style={DOT_STYLE} />}
                  <span style={{ color: META_COLOR }}>{part}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {visibleImages.map((img, idx) => (
          <div key={idx} id={`viewing-image-${idx}`} ref={idx === visibleImages.length - 1 ? lastElementRef : undefined} style={IMAGE_WRAP_STYLE}>
            <div style={{ width: '100%', overflow: 'hidden', padding: 0, margin: 0 }}>
              <img src={img} loading={idx === initialImageIndex ? 'eager' : 'lazy'} decoding="async" onClick={() => onImageClick(images, idx)} style={IMG_STYLE} alt="" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ViewingPostModal.displayName = 'ViewingPostModal';
