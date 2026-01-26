'use client'

import React, { useEffect } from 'react';

interface SuccessPopupProps {
  message: string;
  onClose: () => void;
}

export const SuccessPopup = React.memo<SuccessPopupProps>(({ message, onClose }) => {
  // ปิด modal เมื่อเลื่อนหน้าจอ
  useEffect(() => {
    const handleScroll = () => {
      onClose();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '14px 18px',
          maxWidth: '240px',
          width: 'fit-content',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
        onClick={(e) => e.stopPropagation()}
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
    </div>
  );
});

SuccessPopup.displayName = 'SuccessPopup';
