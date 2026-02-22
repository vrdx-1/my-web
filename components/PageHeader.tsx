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
    variant?: 'default' | 'pill';
  };
  centerTitle?: boolean;
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
  centerTitle = false,
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

  const useCompactLayout = Boolean(actionButton || centerTitle);
  const sideWidth = '72px';

  const backButton = (
    <button
      type="button"
      onClick={handleBack}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1c1e21',
        padding: useCompactLayout ? '5px' : '0',
        minWidth: 44,
        minHeight: 44,
        touchAction: 'manipulation',
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
  );

  return (
    <div
      style={{
        padding: '10px 15px',
        display: 'flex',
        alignItems: 'center',
        gap: useCompactLayout ? '0' : '15px',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 100,
        borderBottom: '1px solid #f0f0f0',
      }}
      className={className}
    >
      {actionButton ? (
        <>
          <div style={{ width: sideWidth, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>{backButton}</div>
          <h3
            style={{
              flex: 1,
              textAlign: 'center',
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              minWidth: 0,
              color: '#111111',
            }}
          >
            {title}
          </h3>
          <div style={{ width: sideWidth, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={actionButton.onClick}
              disabled={actionButton.disabled}
              style={
                actionButton.variant === 'pill'
                  ? {
                      background: '#1877f2',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: actionButton.disabled ? 'not-allowed' : 'pointer',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      opacity: actionButton.disabled ? 0.5 : 1,
                      minHeight: 44,
                      touchAction: 'manipulation',
                    }
                  : {
                      background: 'none',
                      border: 'none',
                      color: '#1877f2',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      cursor: actionButton.disabled ? 'not-allowed' : 'pointer',
                      minWidth: '45px',
                      minHeight: 44,
                      textAlign: 'right',
                      opacity: actionButton.disabled ? 0.5 : 1,
                      touchAction: 'manipulation',
                    }
              }
            >
              {actionButton.label}
            </button>
          </div>
        </>
      ) : centerTitle ? (
        <>
          <div style={{ width: sideWidth, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>{backButton}</div>
          <h3
            style={{
              flex: 1,
              textAlign: 'center',
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              minWidth: 0,
              color: '#111111',
            }}
          >
            {title}
          </h3>
          <div style={{ width: sideWidth, flexShrink: 0 }} aria-hidden />
        </>
      ) : (
        <>
          {backButton}
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#111111' }}>
            {title}
          </h1>
        </>
      )}
    </div>
  );
});

PageHeader.displayName = 'PageHeader';
