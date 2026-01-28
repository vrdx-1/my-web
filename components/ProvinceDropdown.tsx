'use client'

import React, { useState, useEffect, useRef } from 'react';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
                fontFamily: LAO_FONT,
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

  // Button variant — การปิดเปิดแบบปุ่มไข่ปลา (MenuDropdown + useMenu)
  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowList(false);
      setIsAnimating(false);
    }, 300);
  };

  const handleOpen = () => {
    setShowList(true);
    setIsAnimating(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(false));
    });
  };

  const handleToggle = () => {
    if (showList) handleClose();
    else handleOpen();
  };

  const dropdownRect = showList && buttonRef.current
    ? buttonRef.current.getBoundingClientRect()
    : null;

  useEffect(() => {
    if (variant !== 'button' || !showList) return;
    const handleScroll = () => {
      setIsAnimating(true);
      setTimeout(() => {
        setShowList(false);
        setIsAnimating(false);
      }, 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant, showList]);

  useEffect(() => {
    if (variant !== 'button' || !showList) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = (e.target ?? (e as TouchEvent).touches?.[0]?.target) as HTMLElement;
      if (!target) return;
      if (!target.closest('[data-province-dropdown]') && !target.closest('[data-province-button]')) {
        setIsAnimating(true);
        setTimeout(() => {
          setShowList(false);
          setIsAnimating(false);
        }, 300);
      }
    };
    document.addEventListener('mousedown', handleClickOutside as EventListener);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [variant, showList]);

  return (
    <>
      {showList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 10001,
              pointerEvents: 'auto',
            }}
            onClick={handleClose}
          />
          <div
            data-province-dropdown
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              background: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              borderRadius: '8px',
              zIndex: 10002,
              width: '200px',
              maxHeight: 'min(560px, 95vh)',
              overflowY: 'auto',
              touchAction: 'manipulation',
              transform: isAnimating 
                ? 'translate(-50%, -50%) translateY(-10px) scale(0.95)' 
                : 'translate(-50%, -50%)',
              opacity: isAnimating ? 0 : 1,
              transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
              pointerEvents: 'auto',
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
                  padding: '6px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '14px',
                  lineHeight: '1.25',
                  background: selectedProvince === p ? '#e7f3ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                }}
              >
                {p} {selectedProvince === p && '✓'}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={className}>
        <button
          ref={buttonRef}
          data-province-button
          onClick={handleToggle}
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
            touchAction: 'manipulation',
            fontFamily: LAO_FONT,
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
      </div>
    </>
  );
});

ProvinceDropdown.displayName = 'ProvinceDropdown';
