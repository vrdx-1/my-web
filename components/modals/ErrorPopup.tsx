'use client'

import React, { useEffect } from 'react';

interface ErrorPopupProps {
  message: string;
  onClose: () => void;
}

export const ErrorPopup = React.memo<ErrorPopupProps>(({ message, onClose }) => {
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
          padding: '16px 18px 14px 18px',
          maxWidth: '280px',
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
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: '500', color: '#1c1e21', whiteSpace: 'nowrap' }}>
            {message}
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e0245e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
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

ErrorPopup.displayName = 'ErrorPopup';
