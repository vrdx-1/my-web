'use client'

import React, { useEffect } from 'react';
import Link from 'next/link';

interface TermsModalProps {
  show: boolean;
  acceptedTerms: boolean;
  onClose: () => void;
  onAcceptChange: (accepted: boolean) => void;
  onContinue: () => void;
}

export const TermsModal = React.memo<TermsModalProps>(({
  show,
  acceptedTerms,
  onClose,
  onAcceptChange,
  onContinue,
}) => {
  useEffect(() => {
    if (!show || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '350px', padding: '30px 20px', position: 'relative', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '40px 0 30px 0', flexWrap: 'wrap' }}>
          <input 
            type="checkbox" 
            id="modal-terms" 
            checked={acceptedTerms} 
            onChange={(e) => onAcceptChange(e.target.checked)} 
            style={{ width: '20px', height: '20px', cursor: 'pointer' }} 
          />
          <label 
            htmlFor="modal-terms" 
            style={{ fontSize: '15px', color: '#000', cursor: 'pointer' }}
          >
            ຍອມຮັບ
          </label>
          {/* ข้อความสีน้ำเงิน กดเข้าไปอ่านนโยบายได้ โดยไม่ยุ่งกับ checkbox */}
          <Link 
            href="/terms" 
            style={{ 
              color: '#1877f2', 
              textDecoration: 'none', 
              fontWeight: 'bold', 
              cursor: 'pointer' 
            }}
          >
            ຂໍ້ກຳນົດແລະນະໂຍບາຍ
          </Link>
        </div>
        <button 
          onClick={onContinue} 
          disabled={!acceptedTerms} 
          style={{ 
            width: '120px', 
            padding: '12px', 
            background: acceptedTerms ? '#1877f2' : '#e4e6eb', 
            color: acceptedTerms ? '#fff' : '#5c5c5c', 
            border: 'none', 
            borderRadius: '12px', 
            fontWeight: 'bold', 
            fontSize: '16px', 
            cursor: acceptedTerms ? 'pointer' : 'not-allowed', 
            transition: '0.3s' 
          }}
        >
          ຕໍ່ໄປ
        </button>
      </div>
    </div>
  );
});

TermsModal.displayName = 'TermsModal';
