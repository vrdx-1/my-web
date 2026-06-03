'use client';

/* eslint-disable react-hooks/set-state-in-effect */

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
  pickerRef: React.RefObject<HTMLDivElement | null>;
  selectedProvince: string;
  onClose: () => void;
  onApplyProvince: (province: string) => void;
}

function HomeProvincePickerPortalBase(props: HomeProvincePickerPortalProps) {
  const {
    showProvincePicker,
    isAnimating,
    pickerRef,
    selectedProvince,
    onClose,
    onApplyProvince,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [draftProvince, setDraftProvince] = useState('');
  const [showProvincePopup, setShowProvincePopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showProvincePicker) return;
    setDraftProvince(selectedProvince);
    setShowProvincePopup(false);
  }, [selectedProvince, showProvincePicker]);

  const handleCancel = () => {
    onClose();
  };

  const handleSearch = () => {
    onApplyProvince(draftProvince);
  };

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
          left: 0,
          right: 0,
          bottom: 0,
          height: '85vh',
          background: '#fff',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          zIndex: 10002,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: showProvincePicker && !isAnimating ? 'translateY(0)' : 'translateY(100%)',
          opacity: showProvincePicker && !isAnimating ? 1 : 0,
          transition: 'transform 0.28s ease-out, opacity 0.2s ease-out',
          pointerEvents: showProvincePicker ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            padding: '12px 16px 10px',
            minHeight: 52,
            boxSizing: 'border-box',
            fontSize: '16px',
            lineHeight: '1.3',
            borderBottom: '1px solid #eceff3',
            fontFamily: LAO_FONT,
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: '18px',
              color: '#111111',
              fontFamily: LAO_FONT,
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <span style={{ fontSize: '21px', fontWeight: 700 }}>ຕົວກອງ</span>
          <button
            type="button"
            onClick={handleSearch}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: '18px',
              color: '#1877f2',
              fontFamily: LAO_FONT,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ຄົ້ນຫາ
          </button>
        </div>
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid #f2f4f7',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTriggerRect(rect);
              setShowProvincePopup(true);
            }}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              cursor: 'pointer',
              fontFamily: LAO_FONT,
              color: '#111111',
              fontSize: '16px',
              textAlign: 'left',
            }}
          >
            <span>ເລືອກແຂວງ</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
              }}
            >
              {draftProvince || 'ທຸກແຂວງ'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} />
      </div>

      {showProvincePopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10003,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={() => setShowProvincePopup(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: `${(triggerRect?.bottom ?? 140) + 8}px`,
              width: 'min(280px, 88vw)',
              maxHeight: '70vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div
              onClick={() => {
                setDraftProvince('');
                setShowProvincePopup(false);
              }}
              style={{
                padding: '10px 14px',
                minHeight: 42,
                boxSizing: 'border-box',
                fontSize: '16px',
                lineHeight: '1.3',
                background: draftProvince === '' ? '#e7f3ff' : '#fff',
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
              {draftProvince === '' && <SelectedCheckBadge />}
            </div>
            {LAO_PROVINCES.map((province) => (
              <div
                key={province}
                onClick={() => {
                  setDraftProvince(province);
                  setShowProvincePopup(false);
                }}
                style={{
                  padding: '8px 14px',
                  minHeight: 40,
                  boxSizing: 'border-box',
                  fontSize: '15px',
                  lineHeight: '1.3',
                  background: draftProvince === province ? '#e7f3ff' : '#fff',
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
                {draftProvince === province && <SelectedCheckBadge />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export const HomeProvincePickerPortal = memo(HomeProvincePickerPortalBase);