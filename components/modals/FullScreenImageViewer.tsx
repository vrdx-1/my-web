'use client'

import React from 'react';
import { FULLSCREEN_VIEWER_ROOT_ATTR, FULLSCREEN_VIEWER_ROOT_VALUE } from '@/utils/fullScreenMode';

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
};
const IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
};

interface FullScreenImageViewerProps {
  images: string[] | null;
  currentImgIndex: number;
  fullScreenDragOffset: number;
  fullScreenEntranceOffset?: number;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
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
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
}) => {
  if (!images) return null;

  const trackStyle = {
    display: 'flex' as const,
    transition: fullScreenTransitionDuration > 0 ? `transform ${fullScreenTransitionDuration}ms ease-out` : 'none',
    transform: `translateX(calc(-${currentImgIndex * 100}% + ${fullScreenDragOffset}px + ${fullScreenEntranceOffset}px))`,
    width: '100%',
    height: '100%',
  };

  return (
    <div
      {...{ [FULLSCREEN_VIEWER_ROOT_ATTR]: FULLSCREEN_VIEWER_ROOT_VALUE }}
      style={ROOT_STYLE}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
          {images.map((img, idx) => (
            <div
              key={idx}
              style={{
                ...IMG_SLIDE_STYLE,
                borderRight: idx < images.length - 1 ? '1px solid #fff' : undefined,
                boxSizing: 'border-box',
              }}
            >
              <img src={img} style={IMG_STYLE} alt="" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

FullScreenImageViewer.displayName = 'FullScreenImageViewer';
