'use client';

import React, { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';

function SelectedCheckBadge() {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#1877f2',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(24,119,242,0.35)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export interface HomeProvincePickerPortalProps {
  showProvincePicker: boolean;
  isAnimating: boolean;
  filterButtonRect: DOMRect | null;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  selectedProvince: string;
  onClose: () => void;
  onSelectProvince: (province: string) => void;
}

function HomeProvincePickerPortalBase(props: HomeProvincePickerPortalProps) {
  const {
    showProvincePicker,
    isAnimating,
    filterButtonRect,
    pickerRef,
    selectedProvince,
    onClose,
    onSelectProvince,
  } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        pointerEvents: 'none',
        visibility: showProvincePicker ? 'visible' : 'hidden',
        opacity: showProvincePicker ? 1 : 0,
        transition: 'opacity 0.15s ease-out',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 10001,
          pointerEvents: showProvincePicker ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        ref={pickerRef}
        data-home-province-picker
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          ...(filterButtonRect
            ? (() => {
                const gap = 8;
                const width =
                  typeof window !== 'undefined'
                    ? Math.min(220, Math.round(window.innerWidth * 0.62))
                    : 220;
                const left = Math.max(8, filterButtonRect.right - width);
                const top = filterButtonRect.bottom + gap;
                const fullHeight =
                  typeof window !== 'undefined' ? window.innerHeight - top - gap : 500;
                const height = Math.round(fullHeight * 0.92);

                return {
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                };
              })()
            : {
                left: '50%',
                top: '8vh',
                bottom: '8vh',
                width: 'min(280px, 88vw)',
                marginLeft: 'min(-140px, -44vw)',
              }),
          background: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          borderRadius: '12px',
          zIndex: 10002,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: showProvincePicker && !isAnimating ? 'scale(1)' : 'scale(0.96)',
          opacity: showProvincePicker && !isAnimating ? 1 : 0,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          pointerEvents: showProvincePicker ? 'auto' : 'none',
        }}
      >
        <div
          onClick={() => onSelectProvince('')}
          style={{
            padding: '10px 12px',
            minHeight: 42,
            boxSizing: 'border-box',
            fontSize: '16px',
            lineHeight: '1.3',
            background: selectedProvince === '' ? '#e7f3ff' : '#fff',
            cursor: 'pointer',
            fontFamily: LAO_FONT,
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span>ທຸກແຂວງ</span>
          {selectedProvince === '' && <SelectedCheckBadge />}
        </div>
        <div
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            minHeight: 0,
            touchAction: 'pan-y',
          }}
        >
          {LAO_PROVINCES.map((province) => (
            <div
              key={province}
              onClick={() => onSelectProvince(province)}
              style={{
                padding: '6px 12px',
                minHeight: 34,
                boxSizing: 'border-box',
                fontSize: '15px',
                lineHeight: '1.3',
                background: selectedProvince === province ? '#e7f3ff' : '#fff',
                cursor: 'pointer',
                fontFamily: LAO_FONT,
                color: '#111111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>{province}</span>
              {selectedProvince === province && <SelectedCheckBadge />}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const HomeProvincePickerPortal = memo(HomeProvincePickerPortalBase);