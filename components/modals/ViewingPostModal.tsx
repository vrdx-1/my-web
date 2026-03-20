'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Avatar } from '../Avatar';
import { formatTime } from '@/utils/postUtils';

/** จำนวนรูปที่โหลดก่อน (eager) เพื่อให้รูปแรกๆ โผล่เร็ว ส่วนที่เหลือใช้ loading="lazy" */
const VIEWING_MODE_EAGER_COUNT = 5;

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: '#ffffff', backgroundColor: '#ffffff', zIndex: 2000,
  touchAction: 'pan-y', // อนุญาตให้เลื่อนได้เฉพาะแนวตั้งเท่านั้น
};
const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%', height: '100%', background: '#ffffff', backgroundColor: '#ffffff', position: 'relative',
  overflowY: 'auto', overflowX: 'hidden', scrollBehavior: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
  touchAction: 'pan-y', // อนุญาตให้เลื่อนได้เฉพาะแนวตั้งเท่านั้น
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
  background: '#ffffff', backgroundColor: '#ffffff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 2001,
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
  // Use container width instead of `100vw` to avoid width drift when the overlay
  // is animated with `transform` (can cause "stepped" scaling on wide images).
  position: 'relative',
  background: '#ffffff',
  backgroundColor: '#ffffff',
  marginBottom: 12,
  width: '100%',
};
const IMG_STYLE: React.CSSProperties = { width: '100%', height: 'auto', display: 'block', cursor: 'pointer', margin: 0, padding: 0 };
const IMAGE_PLACEHOLDER_STYLE: React.CSSProperties = {
  position: 'relative', width: '100%', overflow: 'hidden', padding: 0, margin: 0,
};
/** Skeleton ขณะรอโหลดรูป — แบบ Facebook (เทาอ่อน + shimmer) ให้ผู้ใช้รู้ว่ายังมีรูปถัดไป */
const IMAGE_SKELETON_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'viewing-image-shimmer 1.5s ease-in-out infinite',
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
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);

  const [enterPhase, setEnterPhase] = useState<'offscreen' | 'entered'>('offscreen');
  const [enterTransitionActive, setEnterTransitionActive] = useState(false);
  const [initialImageLoaded, setInitialImageLoaded] = useState(false);

  const images: string[] = Array.isArray(viewingPost?.images) ? viewingPost.images : [];
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(() => new Set());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoadedIndices(new Set());
    setInitialImageLoaded(false);
  }, [viewingPost?.id, images.length]);

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
    setEnterPhase('offscreen');
    setEnterTransitionActive(false);
  }, [viewingPost?.id]);

  // เปิดทันทีแบบ Facebook — ไม่รอรูปโหลดก่อนสไลด์เข้า
  useEffect(() => {
    if (!isViewingModeOpen || enterPhase !== 'offscreen') return;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flushSync(() => {
          setEnterTransitionActive(true);
        });
        requestAnimationFrame(() => {
          setEnterPhase('entered');
        });
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [isViewingModeOpen, enterPhase]);

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
      // ไม่ต้อง restore scroll position ที่นี่ เพราะ usePostModals จะจัดการให้
      // เพื่อป้องกัน race condition และให้แน่ใจว่า restore ถูกต้อง
      document.body.style.overflow = '';
      document.body.style.scrollbarWidth = '';
      document.body.style.msOverflowStyle = '';
      document.body.removeAttribute('data-viewing-mode');
    };
  }, [viewingPost]);

  // ทางหนี: กด Escape ปิด modal (กรณีค้างหรือใช้คีย์บอร์ด)
  useEffect(() => {
    if (!isViewingModeOpen || !viewingPost) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isViewingModeOpen, viewingPost, onClose]);

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

  // ป้องกันการเลื่อนซ้ายขวาเด็ดขาด: watch scrollLeft และ reset เป็น 0 ทันที
  useEffect(() => {
    if (!isViewingModeOpen) return;
    const container = document.getElementById('viewing-mode-container');
    if (!container) return;

    // Watch scroll event และ reset scrollLeft เป็น 0 ทันที
    const preventHorizontalScroll = () => {
      if (container.scrollLeft !== 0) {
        container.scrollLeft = 0;
      }
    };
    container.addEventListener('scroll', preventHorizontalScroll, { passive: false });

    // อย่าใช้ preventDefault บน touchmove — จะทำให้การเลื่อนแนวตั้งค้างบนมือถือ (ยกเลิก touch sequence)
    // ใช้แค่ scroll listener + rAF ด้านล่าง reset scrollLeft ก็พอ

    // Watch wheel event (สำหรับ desktop) และ preventDefault ถ้ามีการเลื่อนแนวนอน
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) {
        e.preventDefault();
        container.scrollLeft = 0;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    // ใช้ requestAnimationFrame เพื่อ watch scrollLeft ตลอดเวลาและ reset เป็น 0
    let rafId: number;
    const watchScrollLeft = () => {
      if (container.scrollLeft !== 0) {
        container.scrollLeft = 0;
      }
      rafId = requestAnimationFrame(watchScrollLeft);
    };
    rafId = requestAnimationFrame(watchScrollLeft);

    return () => {
      container.removeEventListener('scroll', preventHorizontalScroll);
      container.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(rafId);
    };
  }, [isViewingModeOpen]);

  if (shouldHide) return null;

  // เปิด: สไลด์มาจากด้านขวา (animation เหมือน Bottom sheet 0.3s ease-out). ปิด: ไม่สไลด์ออก สลับหน้าทันที
  // ป้องกันการ drag ซ้ายขวา: ไม่ใช้ viewingModeDragOffset เลย ใช้เฉพาะ enterPhase เพื่อควบคุม animation
  const slideInFromRight = enterPhase === 'offscreen' ? '100%' : '0px';
  const overlayStyle: React.CSSProperties = {
    ...OVERLAY_STYLE,
    transform: `translateX(${slideInFromRight})`,
    transition: enterTransitionActive ? 'transform 0.3s ease-out' : 'none',
  };

  const metaParts = [formatTime(viewingPost.created_at), viewingPost.province];
  if (viewingPost.is_boosted && viewingPost.status !== 'sold') metaParts.push('Ad');

  // เรียก onTouchMove ของ parent (สำหรับ swipe ลงปิด modal)
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    onTouchMove(e);
    // อย่า preventDefault เพื่อกันเลื่อนแนวนอน — จะทำให้การเลื่อนขึ้นลงค้างบนมือถือ
    // scrollLeft ถูก reset อยู่แล้วใน useEffect (scroll listener + rAF)
  }, [onTouchMove]);

  // Reset scrollLeft ใน container โดยไม่ preventDefault (ป้องกันค้าง)
  const handleContainerTouchMove = useCallback((e: React.TouchEvent) => {
    const container = e.currentTarget as HTMLElement;
    if (container.scrollLeft !== 0) {
      container.scrollLeft = 0;
    }
  }, []);

  // Handler เพื่อป้องกันการเลื่อนซ้ายขวาใน container (wheel event สำหรับ desktop)
  const handleContainerWheel = useCallback((e: React.WheelEvent) => {
    const container = e.currentTarget as HTMLElement;
    // ถ้ามีการเลื่อนแนวนอน ให้ preventDefault และบังคับให้ scrollLeft เป็น 0
    if (container.scrollLeft !== 0) {
      e.preventDefault();
      container.scrollLeft = 0;
    }
  }, []);

  return (
    <div style={overlayStyle} onTouchStart={onTouchStart} onTouchMove={handleTouchMove} onTouchEnd={onTouchEnd}>
      <div style={WRAPPER_CLIP_STYLE}>
        <div
          ref={scrollContainerRef}
          id="viewing-mode-container"
          style={isIOS ? CONTAINER_STYLE_IOS_CLIP : CONTAINER_STYLE}
          onTouchMove={handleContainerTouchMove}
          onWheel={handleContainerWheel}
        >
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
        {images.map((img, idx) => {
          const isLoaded = loadedIndices.has(idx);
          return (
            <div key={idx} id={`viewing-image-${idx}`} style={IMAGE_WRAP_STYLE}>
              <div style={{ ...IMAGE_PLACEHOLDER_STYLE, minHeight: isLoaded ? 0 : 280 }}>
                {!isLoaded && <div style={IMAGE_SKELETON_STYLE} aria-hidden="true" />}
                <img
                  src={img}
                  loading={idx < VIEWING_MODE_EAGER_COUNT ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={idx < VIEWING_MODE_EAGER_COUNT ? 'high' : undefined}
                  onLoad={() => handleImageLoad(idx)}
                  onClick={() => onImageClick(images, idx)}
                  style={{
                    ...IMG_STYLE,
                    opacity: isLoaded ? 1 : 0,
                    transition: 'opacity 0.22s ease-out',
                  }}
                  alt=""
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
});

ViewingPostModal.displayName = 'ViewingPostModal';
