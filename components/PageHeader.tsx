'use client'

import React from 'react';
import { useRouter } from 'next/navigation';

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  actionButton?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
}

/**
 * PageHeader Component
 * Reusable header component with back button and title
 * Used across saved, liked, edit-profile, and edit-post pages
 */
export const PageHeader = React.memo<PageHeaderProps>(({
  title,
  onBack,
  actionButton,
  className = '',
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div
      style={{
        padding: '10px 15px',
        display: 'flex',
        alignItems: 'center',
        gap: actionButton ? '0' : '15px',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 100,
        borderBottom: '1px solid #f0f0f0',
      }}
      className={className}
    >
      <button
        onClick={handleBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1c1e21',
          padding: actionButton ? '5px' : '0',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {actionButton ? (
        <>
          <h3
            style={{
              flex: 1,
              textAlign: 'center',
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            {title}
          </h3>
          <button
            onClick={actionButton.onClick}
            disabled={actionButton.disabled}
            style={{
              background: 'none',
              border: 'none',
              color: '#1877f2',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: actionButton.disabled ? 'not-allowed' : 'pointer',
              minWidth: '45px',
              textAlign: 'right',
              opacity: actionButton.disabled ? 0.5 : 1,
            }}
          >
            {actionButton.label}
          </button>
        </>
      ) : (
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {title}
        </h1>
      )}
    </div>
  );
});

PageHeader.displayName = 'PageHeader';
