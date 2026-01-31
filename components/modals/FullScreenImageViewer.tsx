'use client'

import React, { useRef, useState, useCallback } from 'react';
import { FULLSCREEN_VIEWER_ROOT_ATTR, FULLSCREEN_VIEWER_ROOT_VALUE } from '@/utils/fullScreenMode';

interface FullScreenImageViewerProps {
  images: string[] | null;
  currentImgIndex: number;
  fullScreenDragOffset: number;
  fullScreenVerticalDragOffset: number;
  fullScreenIsDragging: boolean;
  fullScreenTransitionDuration: number;
  fullScreenShowDetails: boolean;
  fullScreenZoomScale: number;
  fullScreenZoomOrigin: string;
  activePhotoMenu: number | null;
  isPhotoMenuAnimating: boolean;
  showDownloadBottomSheet: boolean;
  isDownloadBottomSheetAnimating: boolean;
  showImageForDownload: string | null;
  onClose: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (url: string) => void;
  onImageIndexChange: (index: number) => void;
  onPhotoMenuToggle: (index: number) => void;
  onDownloadBottomSheetClose: () => void;
  onDownloadBottomSheetDownload: () => void;
  onImageForDownloadClose: () => void;
}

export const FullScreenImageViewer = React.memo<FullScreenImageViewerProps>(({
  images,
  currentImgIndex,
  fullScreenDragOffset,
  fullScreenVerticalDragOffset,
  fullScreenIsDragging,
  fullScreenTransitionDuration,
  fullScreenShowDetails,
  fullScreenZoomScale,
  fullScreenZoomOrigin,
  activePhotoMenu,
  isPhotoMenuAnimating,
  showDownloadBottomSheet,
  isDownloadBottomSheetAnimating,
  showImageForDownload,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  onDownload,
  onImageIndexChange,
  onPhotoMenuToggle,
  onDownloadBottomSheetClose,
  onDownloadBottomSheetDownload,
  onImageForDownloadClose,
}) => {
  const photoMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  if (!images) return null;

  return (
    <>
      <div 
        {...{ [FULLSCREEN_VIEWER_ROOT_ATTR]: FULLSCREEN_VIEWER_ROOT_VALUE }}
        style={{ 
          position: 'fixed', 
          inset: 0, 
          background: '#000', 
          zIndex: 3000, 
          display: 'flex', 
          flexDirection: 'column', 
          touchAction: 'none' 
        }} 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd} 
        onClick={onClick}
      >
        <div style={{ 
          padding: '15px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          position: 'relative', 
          opacity: fullScreenShowDetails ? 1 : 0, 
          transition: 'none', 
          pointerEvents: fullScreenShowDetails ? 'auto' : 'none' 
        }}>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div style={{ 
            position: 'absolute', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            color: '#fff', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            padding: 0, 
            margin: 0 
          }}>
            {currentImgIndex + 1}/{images.length}
          </div>
          {/* Removed download/save menu */}
          <div style={{ width: '44px', height: '44px' }} />
        </div>
        <div 
          ref={(el) => {
            // Store ref for zoom calculations
            if (el) (el as any).fullScreenImageContainerRef = el;
          }}
          style={{ 
            flex: 1, 
            position: 'relative', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            overflow: 'hidden' 
          }}
        >
          <div style={{ 
            display: 'flex', 
          transition: fullScreenTransitionDuration > 0 ? `transform ${fullScreenTransitionDuration}ms ease-out` : 'none', 
            transform: `translateX(calc(-${currentImgIndex * 100}% + ${fullScreenDragOffset}px)) translateY(${fullScreenVerticalDragOffset}px)`, 
            width: '100%', 
            height: '100%' 
          }}>
            {images.map((img, idx) => (
              <div 
                key={idx} 
                style={{ 
                  minWidth: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%', 
                  // Zoom disabled: always render at scale(1)
                  transform: 'scale(1)', 
                  transformOrigin: 'center center', 
                  transition: 'none' 
                }}
              >
                <img 
                  src={img} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain', 
                    objectPosition: 'center' 
                  }} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
});

FullScreenImageViewer.displayName = 'FullScreenImageViewer';
