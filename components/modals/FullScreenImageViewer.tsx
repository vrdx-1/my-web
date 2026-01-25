'use client'

import React, { useRef, useState, useCallback } from 'react';

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
          transition: 'opacity 0.35s ease-out', 
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
          <div style={{ position: 'relative' }}>
            <button 
              ref={photoMenuButtonRef} 
              data-menu-button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onPhotoMenuToggle(currentImgIndex); 
              }} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '10px', 
                touchAction: 'manipulation' 
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <circle cx="5" cy="12" r="2.5" />
                <circle cx="12" cy="12" r="2.5" />
                <circle cx="19" cy="12" r="2.5" />
              </svg>
            </button>
            {activePhotoMenu === currentImgIndex && (() => {
              const buttonEl = photoMenuButtonRef.current;
              const rect = buttonEl?.getBoundingClientRect();
              const menuTop = rect ? rect.bottom + 4 : 0;
              const menuRight = rect ? window.innerWidth - rect.right : 0;
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3100, pointerEvents: 'none' }}>
                  <div 
                    style={{ 
                      position: 'fixed', 
                      inset: 0, 
                      background: 'rgba(0,0,0,0.3)', 
                      zIndex: 3101, 
                      pointerEvents: 'auto' 
                    }} 
                    onClick={onDownloadBottomSheetClose}
                  />
                  <div 
                    data-menu-container 
                    onClick={(e) => e.stopPropagation()} 
                    onMouseDown={(e) => e.stopPropagation()} 
                    onTouchStart={(e) => e.stopPropagation()} 
                    style={{ 
                      position: 'fixed', 
                      right: `${menuRight}px`, 
                      top: `${menuTop}px`, 
                      background: '#fff', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                      borderRadius: '8px', 
                      width: '130px', 
                      zIndex: 3102, 
                      overflow: 'hidden', 
                      touchAction: 'manipulation', 
                      transform: isPhotoMenuAnimating ? 'translateY(-10px) scale(0.95)' : 'translateY(0) scale(1)', 
                      opacity: isPhotoMenuAnimating ? 0 : 1, 
                      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out', 
                      pointerEvents: 'auto' 
                    }}
                  >
                    <div 
                      onClick={() => { 
                        onPhotoMenuToggle(-1); 
                        onDownload(images[currentImgIndex]); 
                      }} 
                      style={{ 
                        padding: '15px', 
                        fontSize: '14px', 
                        cursor: 'pointer', 
                        color: '#1c1e21', 
                        fontWeight: 'bold', 
                        textAlign: 'center' 
                      }}
                    >
                      ບັນທຶກຮູບ
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
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
            transition: fullScreenIsDragging ? 'none' : `transform ${fullScreenTransitionDuration}ms ease-out`, 
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
                  transform: idx === currentImgIndex ? `scale(${fullScreenZoomScale})` : 'scale(1)', 
                  transformOrigin: idx === currentImgIndex ? fullScreenZoomOrigin : 'center center', 
                  transition: fullScreenIsDragging ? 'none' : 'transform 0.2s ease-out' 
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

      {showDownloadBottomSheet && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 4000, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center', 
            transition: 'background 0.3s' 
          }} 
          onClick={onDownloadBottomSheetClose}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              width: '100%', 
              background: '#fff', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
              borderRadius: '20px 20px 0 0', 
              transform: isDownloadBottomSheetAnimating ? 'translateY(100%)' : 'translateY(0)', 
              transition: 'transform 0.3s ease-out', 
              overflow: 'hidden', 
              border: '1px solid #eee' 
            }}
          >
            <div 
              style={{ 
                padding: '8px 0', 
                display: 'flex', 
                justifyContent: 'center', 
                cursor: 'pointer' 
              }} 
              onClick={onDownloadBottomSheetClose}
            >
              <div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div>
            </div>
            <div 
              onClick={onDownloadBottomSheetDownload} 
              style={{ 
                padding: '15px', 
                fontSize: '14px', 
                cursor: 'pointer', 
                color: '#1c1e21', 
                fontWeight: 'bold', 
                textAlign: 'center', 
                background: '#fff', 
                borderBottom: '1px solid #eee' 
              }}
            >
              ບັນທຶກຮູບ
            </div>
            <div 
              onClick={onDownloadBottomSheetClose} 
              style={{ 
                padding: '15px', 
                fontSize: '14px', 
                cursor: 'pointer', 
                color: '#65676b', 
                textAlign: 'center', 
                background: '#fff' 
              }}
            >
              ຍົກເລີກ
            </div>
          </div>
        </div>
      )}

      {showImageForDownload && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.9)', 
            zIndex: 4000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '20px' 
          }} 
          onClick={onImageForDownloadClose}
        >
          <img 
            src={showImageForDownload} 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain', 
              userSelect: 'none', 
              WebkitUserSelect: 'none', 
              WebkitTouchCallout: 'default' 
            }} 
            onContextMenu={(e) => e.preventDefault()} 
          />
        </div>
      )}
    </>
  );
});

FullScreenImageViewer.displayName = 'FullScreenImageViewer';
