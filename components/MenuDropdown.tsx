'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { commonStyles } from '@/utils/commonStyles';

interface MenuDropdownProps {
  postId: string;
  isOwner: boolean;
  isOpen: boolean;
  isAnimating: boolean;
  menuTop: number;
  menuRight: number;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBoost?: () => void;
  onReport?: () => void;
}

/**
 * MenuDropdown Component
 * Reusable dropdown menu for post actions.
 * Renders via Portal into document.body so overlay background covers full viewport
 * (avoids being clipped by ancestor transform/stacking context).
 */
export const MenuDropdown = React.memo<MenuDropdownProps>(({
  postId,
  isOwner,
  isOpen,
  isAnimating,
  menuTop,
  menuRight,
  onClose,
  onEdit,
  onDelete,
  onBoost,
  onReport,
}) => {
  const router = useRouter();

  if (!isOpen) return null;

  const showBoost = typeof onBoost === 'function';

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 10001,
          pointerEvents: 'auto',
        }}
        onClick={onClose}
      />
      <div
        data-menu-container
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          right: `${menuRight}px`,
          top: `${menuTop}px`,
          background: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '8px',
          zIndex: 10002,
          width: '130px',
          overflow: 'hidden',
          touchAction: 'manipulation',
          transform: isAnimating ? 'translateY(-10px) scale(0.95)' : 'translateY(0) scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          pointerEvents: 'auto',
        }}
      >
        {isOwner ? (
          <>
            <div onClick={onEdit} style={commonStyles.menuItem}>
              ແກ້ໄຂ
            </div>
            <div onClick={onDelete} style={showBoost ? commonStyles.menuItem : commonStyles.menuItemLast}>
              ລົບ
            </div>
            {showBoost && (
              <div onClick={onBoost} style={commonStyles.menuItemLast}>
                boost ໂພສ
              </div>
            )}
          </>
        ) : (
          <div onClick={onReport} style={commonStyles.menuItemLast}>
            ລາຍງານ
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
});

MenuDropdown.displayName = 'MenuDropdown';
