'use client'

import React, { useEffect } from 'react';

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = React.memo<DeleteConfirmModalProps>(({ onConfirm, onCancel }) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
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
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
          ທ່ານຕ້ອງການລົບໂພສບໍ?
        </h3>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#e4e6eb',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1c1e21',
              cursor: 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#1877f2',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ລົບ
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteConfirmModal.displayName = 'DeleteConfirmModal';
