'use client'

import React, { useState } from 'react';
import { LAO_PROVINCES } from '@/utils/constants';

interface ProvinceDropdownProps {
  selectedProvince: string;
  onProvinceChange: (province: string) => void;
  variant?: 'button' | 'list';
  className?: string;
}

/**
 * ProvinceDropdown Component
 * Reusable province selector component
 * Used in create-post and edit-post pages
 */
export const ProvinceDropdown = React.memo<ProvinceDropdownProps>(({
  selectedProvince,
  onProvinceChange,
  variant = 'button',
  className = '',
}) => {
  const [showList, setShowList] = useState(false);

  if (variant === 'list') {
    // List variant (used in create-post step 3)
    return (
      <div className={className}>
        {LAO_PROVINCES.map((p) => (
          <div
            key={p}
            onClick={() => onProvinceChange(p)}
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer',
              background: '#fff',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: selectedProvince === p ? 'bold' : 'normal',
                color: '#000',
              }}
            >
              {p}
            </span>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: selectedProvince === p ? '#1877f2' : '#e4e6eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedProvince === p && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Button variant (used in edit-post)
  return (
    <div style={{ position: 'relative' }} className={className}>
      <button
        onClick={() => setShowList(!showList)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: '#f0f2f5',
          border: 'none',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          marginTop: '2px',
          cursor: 'pointer',
        }}
      >
        {selectedProvince || 'ເລືອກແຂວງ'}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showList && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            zIndex: 110,
            width: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            marginTop: '5px',
          }}
        >
          {LAO_PROVINCES.map((p) => (
            <div
              key={p}
              onClick={() => {
                onProvinceChange(p);
                setShowList(false);
              }}
              style={{
                padding: '10px 15px',
                borderBottom: '1px solid #f0f0f0',
                fontSize: '14px',
                background: selectedProvince === p ? '#e7f3ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              {p} {selectedProvince === p && '✓'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ProvinceDropdown.displayName = 'ProvinceDropdown';
