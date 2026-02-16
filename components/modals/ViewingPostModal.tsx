'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Avatar } from '../Avatar';
import { PageSpinner } from '../LoadingSpinner';
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
/** บน iOS ::-webkit-scrollbar ไม่ทำงาน ใช้ wrapper clip scrollbar ออก (กว้างเกิน 30px แล้วให้ wrapper overflow:hidden) */
const CONTAINER_STYLE_IOS_CLIP: React.CSSProperties = {
  ...CONTAINER_STYLE,
  width: 'calc(100% + 30px)',
};
const WRAPPER_CLIP_STYLE: React.CSSProperties = {
  overflow: 'hidden', width: '100%', height: '100%',
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
const IMAGE_PLACEHOLDER_STYLE: React.CSSProperties = {
  position: 'relative', width: '100%', overflow: 'hidden', padding: 0, margin: 0, minHeight: 200,
};
const SPINNER_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', zIndex: 1,
};

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
  const [enterTransitionActive, setEnterTransitionActive] = useState(false);
  const [initialImageLoaded, setInitialImageLoaded] = useState(false);

  const images: string[] = Array.isArray(viewingPost?.images) ? viewingPost.images : [];

  const initialVisible = useMemo(
    () => Math.min(images.length || 0, Math.max(VIEWING_MODE_INITIAL_VISIBLE, (initialImageIndex ?? 0) + 3)),
    [initialImageIndex, images.length]
  );
  const [visibleCount, setVisibleCount] = useState<number>(() => initialVisible);
  const [localLoadingMore, setLocalLoadingMore] = useState<boolean>(false);
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    // รูปที่คลิกแสดงใน post card อยู่แล้ว ถือว่าโหลดแล้ว ไม่แสดง spinner
    const safeIdx = images.length ? Math.min(initialImageIndex, images.length - 1) : 0;
    setLoadedIndices(new Set(images.length ? [safeIdx] : []));
    setInitialImageLoaded(false);
  }, [viewingPost?.id, initialImageIndex, images.length]);

  useEffect(() => {
    if (images.length === 0 && isViewingModeOpen) setInitialImageLoaded(true);
  }, [images.length, isViewingModeOpen]);

  const handleImageLoad = useCallback((idx: number) => {
    setLoadedIndices((prev) => new Set(prev).add(idx));
    if (idx === initialImageIndex) {
      setInitialImageLoaded(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(`viewing-image-${idx}`);
          if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
        });
      });
    }
  }, [initialImageIndex]);

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
    setEnterTransitionActive(false);
  }, [viewingPost?.id]);

  useEffect(() => {
    if (!isViewingModeOpen || enterPhase !== 'offscreen') return;
    const canEnter = initialImageLoaded || images.length === 0;
    if (!canEnter) {
      const fallback = setTimeout(() => {
        setInitialImageLoaded(true);
      }, 400);
      return () => clearTimeout(fallback);
    }
    const rafId = requestAnimationFrame(() => {
      setEnterTransitionActive(true);
      setEnterPhase('entered');
    });
    return () => cancelAnimationFrame(rafId);
  }, [isViewingModeOpen, enterPhase, initialImageLoaded, images.length]);

  useEffect(() => {
    if (enterPhase !== 'entered' || !enterTransitionActive) return;
    const t = setTimeout(() => setEnterTransitionActive(false), 350);
    return () => clearTimeout(t);
  }, [enterPhase, enterTransitionActive]);

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

  // เปิด: สไลด์มาจากด้านขวา (animation เหมือน Bottom sheet 0.3s ease-out). ปิด: ไม่สไลด์ออก สลับหน้าทันที
  const slideInFromRight = enterPhase === 'offscreen' ? '100%' : `${viewingModeDragOffset}px`;
  const overlayStyle: React.CSSProperties = {
    ...OVERLAY_STYLE,
    transform: `translateX(${slideInFromRight})`,
    transition: enterTransitionActive ? 'transform 0.3s ease-out' : 'none',
  };

  const metaParts = [formatTime(viewingPost.created_at), viewingPost.province];
  if (viewingPost.is_boosted) metaParts.push('Ad');

  return (
    <div style={overlayStyle} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={WRAPPER_CLIP_STYLE}>
        <div id="viewing-mode-container" style={CONTAINER_STYLE_IOS_CLIP}>
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
            <div style={IMAGE_PLACEHOLDER_STYLE}>
              {!loadedIndices.has(idx) && idx !== initialImageIndex && (
                <div style={SPINNER_OVERLAY_STYLE} aria-hidden="true">
                  <PageSpinner />
                </div>
              )}
              <img
                src={img}
                loading={idx < initialVisible ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() => handleImageLoad(idx)}
                onClick={() => onImageClick(images, idx)}
                style={IMG_STYLE}
                alt=""
              />
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
});

ViewingPostModal.displayName = 'ViewingPostModal';
