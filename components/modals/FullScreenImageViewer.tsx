'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { FULLSCREEN_VIEWER_ROOT_ATTR, FULLSCREEN_VIEWER_ROOT_VALUE } from '@/utils/fullScreenMode';
import { normalizeImageUrl } from '@/utils/avatarUtils';

const ROOT_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#000',
  zIndex: 3000,
  display: 'flex',
  flexDirection: 'column',
  touchAction: 'none',
};
const HEADER_STYLE: React.CSSProperties = {
  padding: '15px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'relative',
};
const BACK_BTN_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  touchAction: 'manipulation',
};
const COUNTER_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
  padding: 0,
  margin: 0,
};
const IMG_SLIDE_STYLE: React.CSSProperties = {
  minWidth: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  position: 'relative',
};
const IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
};
/** Skeleton ขณะรอโหลดรูปถัดไป — แบบ Facebook (พื้นดำ + shimmer) */
const FULLSCREEN_SKELETON_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
  backgroundSize: '200% 100%',
  animation: 'viewing-image-shimmer 1.5s ease-in-out infinite',
};
const SLIDE_GAP_PX = 8;

interface FullScreenImageViewerProps {
  images: string[] | null;
  currentImgIndex: number;
  fullScreenDragOffset: number;
  fullScreenEntranceOffset?: number;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  onClose: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export const FullScreenImageViewer = React.memo<FullScreenImageViewerProps>(({
  images,
  currentImgIndex,
  fullScreenDragOffset,
  fullScreenEntranceOffset = 0,
  fullScreenTransitionDuration,
  fullScreenShowDetails,
  fullScreenZoomScale,
  fullScreenZoomOrigin,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
}) => {
  void fullScreenShowDetails;

  const [loadedImageSrcs, setLoadedImageSrcs] = useState<Set<string>>(() => new Set());
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panBaseRef = useRef({ x: 0, y: 0 });
  const panLastPointRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaLastAtRef = useRef(0);

  const clampPanOffset = useCallback((x: number, y: number, scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 };
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
    const maxX = Math.max(0, ((viewportWidth * scale) - viewportWidth) / 2);
    const maxY = Math.max(0, ((viewportHeight * scale) - viewportHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const stopPanInertia = useCallback(() => {
    if (inertiaRafRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  const startPanInertia = useCallback((scale: number) => {
    if (typeof window === 'undefined') return;
    stopPanInertia();
    inertiaLastAtRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.max(1, now - inertiaLastAtRef.current);
      inertiaLastAtRef.current = now;

      let shouldStop = false;

      setPanOffset((prev) => {
        const factor = dt / 16.67;
        const nextX = prev.x + panVelocityRef.current.x * factor;
        const nextY = prev.y + panVelocityRef.current.y * factor;
        const clamped = clampPanOffset(nextX, nextY, scale);

        if (Math.abs(clamped.x - nextX) > 0.1) panVelocityRef.current.x = 0;
        if (Math.abs(clamped.y - nextY) > 0.1) panVelocityRef.current.y = 0;

        panVelocityRef.current.x *= Math.pow(0.92, factor);
        panVelocityRef.current.y *= Math.pow(0.92, factor);

        if (Math.abs(panVelocityRef.current.x) < 0.08 && Math.abs(panVelocityRef.current.y) < 0.08) {
          shouldStop = true;
          return clamped;
        }

        return clamped;
      });

      if (shouldStop) {
        stopPanInertia();
        return;
      }

      inertiaRafRef.current = window.requestAnimationFrame(tick);
    };

    inertiaRafRef.current = window.requestAnimationFrame(tick);
  }, [clampPanOffset, stopPanInertia]);

  const activePanOffset = useMemo(() => {
    if (fullScreenZoomScale <= 1.001) return { x: 0, y: 0 };
    return clampPanOffset(panOffset.x, panOffset.y, fullScreenZoomScale);
  }, [clampPanOffset, fullScreenZoomScale, panOffset.x, panOffset.y]);

  useEffect(() => () => stopPanInertia(), [stopPanInertia]);

  const handleImageLoad = useCallback((src: string) => {
    setLoadedImageSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  const handleRootTouchStart = useCallback((e: React.TouchEvent) => {
    stopPanInertia();

    if (fullScreenZoomScale > 1 && e.touches.length === 1) {
      const t = e.touches[0];
      panStartRef.current = { x: t.clientX, y: t.clientY };
      panBaseRef.current = activePanOffset;
      panLastPointRef.current = { x: t.clientX, y: t.clientY, at: performance.now() };
      panVelocityRef.current = { x: 0, y: 0 };
    } else if (e.touches.length >= 2) {
      // Entering pinch: clear stale pan base so next zoom starts from a predictable center.
      panStartRef.current = null;
      panLastPointRef.current = null;
      panVelocityRef.current = { x: 0, y: 0 };
      setPanOffset({ x: 0, y: 0 });
    } else {
      panStartRef.current = null;
      panLastPointRef.current = null;
      panVelocityRef.current = { x: 0, y: 0 };
    }
    onTouchStart(e);
  }, [activePanOffset, fullScreenZoomScale, onTouchStart, stopPanInertia]);

  const handleRootTouchMove = useCallback((e: React.TouchEvent) => {
    if (fullScreenZoomScale > 1 && panStartRef.current && e.touches.length === 1) {
      const t = e.touches[0];
      const deltaX = t.clientX - panStartRef.current.x;
      const deltaY = t.clientY - panStartRef.current.y;

      const now = performance.now();
      const prev = panLastPointRef.current;
      if (prev) {
        const dt = Math.max(1, now - prev.at);
        panVelocityRef.current = {
          x: ((t.clientX - prev.x) / dt) * 16.67,
          y: ((t.clientY - prev.y) / dt) * 16.67,
        };
      }
      panLastPointRef.current = { x: t.clientX, y: t.clientY, at: now };

      const next = clampPanOffset(
        panBaseRef.current.x + deltaX,
        panBaseRef.current.y + deltaY,
        fullScreenZoomScale,
      );
      setPanOffset(next);
      e.preventDefault();
    }
    onTouchMove(e);
  }, [clampPanOffset, fullScreenZoomScale, onTouchMove]);

  const handleRootTouchEnd = useCallback((e: React.TouchEvent) => {
    if (fullScreenZoomScale > 1 && e.touches.length === 0) {
      const speed = Math.hypot(panVelocityRef.current.x, panVelocityRef.current.y);
      if (speed > 0.9) {
        startPanInertia(fullScreenZoomScale);
      }
    }

    panStartRef.current = null;
    panLastPointRef.current = null;
    onTouchEnd(e);
  }, [fullScreenZoomScale, onTouchEnd, startPanInertia]);

  if (!images) return null;

  const trackStyle = {
    display: 'flex' as const,
    gap: `${SLIDE_GAP_PX}px`,
    transition: fullScreenTransitionDuration > 0 ? `transform ${fullScreenTransitionDuration}ms ease-out` : 'none',
    transform: `translateX(calc(-${currentImgIndex} * (100% + ${SLIDE_GAP_PX}px) + ${fullScreenDragOffset}px + ${fullScreenEntranceOffset}px))`,
    width: '100%',
    height: '100%',
  };

  return (
    <div
      {...{ [FULLSCREEN_VIEWER_ROOT_ATTR]: FULLSCREEN_VIEWER_ROOT_VALUE }}
      style={ROOT_STYLE}
      onTouchStart={handleRootTouchStart}
      onTouchMove={handleRootTouchMove}
      onTouchEnd={handleRootTouchEnd}
      onClick={onClick}
    >
      <div style={{ ...HEADER_STYLE, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, opacity: 1, transition: 'none', pointerEvents: 'auto' }}>
        <button type="button" onClick={onClose} style={BACK_BTN_STYLE} aria-label="Close">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={COUNTER_STYLE}>{currentImgIndex + 1}/{images.length}</div>
        <div style={{ width: 44, height: 44 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={trackStyle}>
          {images.map((img, idx) => {
            const normalizedSrc = normalizeImageUrl(img, 'car-images');
            const isLoaded = loadedImageSrcs.has(normalizedSrc);
            return (
              <div key={idx} style={IMG_SLIDE_STYLE}>
                {!isLoaded && (
                  <div style={FULLSCREEN_SKELETON_STYLE} aria-hidden="true" />
                )}
                <img
                  src={normalizedSrc}
                  onLoad={() => handleImageLoad(normalizedSrc)}
                  style={{
                    ...IMG_STYLE,
                    position: 'relative',
                    zIndex: 1,
                    opacity: isLoaded ? 1 : 0,
                    transition: 'opacity 0.22s ease-out',
                    transform: idx === currentImgIndex
                      ? `translate3d(${activePanOffset.x}px, ${activePanOffset.y}px, 0) scale(${fullScreenZoomScale})`
                      : 'scale(1)',
                    transformOrigin: idx === currentImgIndex ? fullScreenZoomOrigin : '50% 50%',
                  }}
                  alt=""
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

FullScreenImageViewer.displayName = 'FullScreenImageViewer';
