'use client'

import React, { useEffect } from 'react';
import { ButtonSpinner } from '@/components/LoadingSpinner';

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}

export const DeleteConfirmModal = React.memo<DeleteConfirmModalProps>(({ 
  onConfirm,
  onCancel,
  loading = false,
  title = 'ທ່ານຕ້ອງການລົບໂພສບໍ?',
  cancelLabel = 'ຍົກເລີກ',
  confirmLabel = 'ລົບ',
}) => {
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
          background: '#ffffff',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
          {title}
        </h3>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#e4e6eb',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1c1e21',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#1877f2',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <ButtonSpinner />
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteConfirmModal.displayName = 'DeleteConfirmModal';
