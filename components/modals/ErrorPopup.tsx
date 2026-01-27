'use client'

import React, { useEffect } from 'react';

interface ErrorPopupProps {
  message: string;
  onClose: () => void;
}

export const ErrorPopup = React.memo<ErrorPopupProps>(({ message, onClose }) => {
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
          padding: '10px 14px',
          maxWidth: '280px',
          width: 'fit-content',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
        onClick={(e) => e.stopPropagation()}
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
    </div>
  );
});

ErrorPopup.displayName = 'ErrorPopup';
