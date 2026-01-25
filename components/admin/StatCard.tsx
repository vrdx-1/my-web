'use client'

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number | React.ReactNode;
  loading?: boolean;
  variant?: 'default' | 'centered';
  className?: string;
}

/**
 * StatCard Component
 * Reusable statistics card component for admin pages
 * Used in admin/overview, admin/visitor, and admin/activity pages
 */
export const StatCard = React.memo<StatCardProps>(({
  label,
  value,
  loading = false,
  variant = 'default',
  className = '',
}) => {
  const getCardStyle = () => {
    if (variant === 'centered') {
      return {
        flex: 1,
        padding: '20px',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        textAlign: 'center' as const,
        border: '1px solid #f0f2f5',
      };
    }
    // default variant
    return {
      background: '#fff',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      border: '1px solid #f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    };
  };

  const labelStyle = {
    color: '#1a1a1a',
    fontSize: variant === 'centered' ? '14px' : '16px',
    fontWeight: '500' as const,
  };

  const valueStyle = {
    fontSize: variant === 'centered' ? '24px' : '18px',
    fontWeight: 'bold' as const,
    color: '#1a1a1a',
  };

  return (
    <div style={getCardStyle()} className={className}>
      {variant === 'centered' ? (
        <>
          <div style={{ ...labelStyle, marginBottom: '8px' }}>{label}</div>
          <div style={valueStyle}>{loading ? '...' : value}</div>
        </>
      ) : (
        <>
          <span style={labelStyle}>{label}</span>
          <span style={valueStyle}>{loading ? '...' : value}</span>
        </>
      )}
    </div>
  );
});

StatCard.displayName = 'StatCard';
