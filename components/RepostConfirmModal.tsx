'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { ButtonSpinner } from './LoadingSpinner';

interface RepostConfirmModalProps {
  isOpen: boolean;
  isReposting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const RepostConfirmModal = React.memo<RepostConfirmModalProps>(({
  isOpen,
  isReposting,
  onCancel,
  onConfirm,
}) => {
  if (typeof document === 'undefined' || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
          ທ່ານຕ້ອງການໂພສໃໝ່ບໍ?
        </h3>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isReposting}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#e4e6eb',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1c1e21',
              cursor: isReposting ? 'not-allowed' : 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isReposting}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#1877f2',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#fff',
              cursor: isReposting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isReposting ? 0.6 : 1,
            }}
          >
            {isReposting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <ButtonSpinner />
              </span>
            ) : 'ໂພສໃໝ່'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

RepostConfirmModal.displayName = 'RepostConfirmModal';
