'use client'

import React from 'react';
import { LAO_FONT } from '@/utils/constants';

interface EmptyStateProps {
  message: string;
  variant?: 'default' | 'card' | 'minimal';
  className?: string;
}

/**
 * EmptyState Component
 * Reusable empty state message component
 * Used across PostFeed, admin pages, notification pages, and modals
 */
export const EmptyState = React.memo<EmptyStateProps>(({
  message,
  variant = 'default',
  className = '',
}) => {
  const getStyle = () => {
    switch (variant) {
      case 'card':
        return {
          background: '#fff',
          padding: '40px',
          textAlign: 'center' as const,
          borderRadius: '8px',
          fontFamily: LAO_FONT,
        };
      case 'minimal':
        return {
          textAlign: 'center' as const,
          padding: '30px',
          color: '#888',
          fontFamily: LAO_FONT,
        };
      default: // 'default'
        return {
          textAlign: 'center' as const,
          padding: '100px 20px',
          color: '#4a4d52',
          fontSize: '16px',
          fontFamily: LAO_FONT,
        };
    }
  };

  return (
    <div style={getStyle()} className={className}>
      {message}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
