'use client'

import React, { useEffect } from 'react';

interface SuccessPopupProps {
  message: string;
  onClose: () => void;
}

export const SuccessPopup = React.memo<SuccessPopupProps>(({ message, onClose }) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 6000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '18px 20px 16px 20px',
          maxWidth: '260px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: '500', color: '#1c1e21' }}>
            {message}
          </span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#31a24c"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '4px',
            width: '100%',
            padding: '10px 16px',
            background: '#1877f2',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ຕົກລົງ
        </button>
      </div>
    </div>
  );
});

SuccessPopup.displayName = 'SuccessPopup';
