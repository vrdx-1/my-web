'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { commonStyles } from '@/utils/commonStyles';

const menuItemContentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const menuItemIconStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  color: '#4a4d52',
  flexShrink: 0,
};

const ActionLabel = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <span style={menuItemContentStyle}>
    <span style={menuItemIconStyle}>{icon}</span>
    <span>{label}</span>
  </span>
);

const LineIcon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const saveIcon = (
  <LineIcon>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </LineIcon>
);

const shareIcon = (
  <LineIcon>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
  </LineIcon>
);

const editIcon = (
  <LineIcon>
    <path d="M12 20h9" />
    <path d="M17.5 3.5a2.12 2.12 0 1 1 3 3L9 18l-4 1 1-4 11.5-11.5z" />
  </LineIcon>
);

const deleteIcon = (
  <LineIcon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </LineIcon>
);

const boostIcon = (
  <LineIcon>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </LineIcon>
);

const privateNoteIcon = (
  <LineIcon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </LineIcon>
);

const reportIcon = (
  <LineIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6" />
    <path d="M12 16h.01" />
  </LineIcon>
);

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
  onSave?: () => void;
  saveLabel?: string;
  onShare?: () => void;
  onBoost?: () => void;
  onReport?: () => void;
  onPrivateNote?: () => void;
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
  onSave,
  saveLabel,
  onShare,
  onBoost,
  onReport,
  onPrivateNote,
}) => {
  const router = useRouter();

  if (!isOpen) return null;

  const showBoost = typeof onBoost === 'function';
  const showPrivateNote = typeof onPrivateNote === 'function';
  const resolvedSaveLabel = saveLabel || 'ບັນທຶກໂພສ';

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
          background: '#ffffff',
          backgroundColor: '#ffffff',
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
            <div onClick={onSave} style={commonStyles.menuItem}>
              <ActionLabel
                label={resolvedSaveLabel}
                icon={saveIcon}
              />
            </div>
            <div onClick={onShare} style={commonStyles.menuItem}>
              <ActionLabel
                label="ແຊໂພສ"
                icon={shareIcon}
              />
            </div>
            <div onClick={onEdit} style={commonStyles.menuItem}>
              <ActionLabel
                label="ແກ້ໄຂໂພສ"
                icon={editIcon}
              />
            </div>
            <div
              onClick={onDelete}
              style={showBoost || showPrivateNote ? commonStyles.menuItem : commonStyles.menuItemLast}
            >
              <ActionLabel
                label="ລົບໂພສ"
                icon={deleteIcon}
              />
            </div>
            {showBoost && (
              <div
                onClick={onBoost}
                style={showPrivateNote ? commonStyles.menuItem : commonStyles.menuItemLast}
              >
                <ActionLabel
                  label="boost ໂພສ"
                  icon={boostIcon}
                />
              </div>
            )}
            {showPrivateNote && (
              <div onClick={onPrivateNote} style={commonStyles.menuItemLast}>
                <ActionLabel
                  label="ໂນດສ່ວນຕົວ"
                  icon={privateNoteIcon}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div onClick={onSave} style={commonStyles.menuItem}>
              <ActionLabel
                label={resolvedSaveLabel}
                icon={saveIcon}
              />
            </div>
            <div onClick={onShare} style={commonStyles.menuItem}>
              <ActionLabel
                label="ແຊໂພສ"
                icon={shareIcon}
              />
            </div>
            <div onClick={onReport} style={commonStyles.menuItemLast}>
              <ActionLabel
                label="ລາຍງານໂພສ"
                icon={reportIcon}
              />
            </div>
          </>
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
