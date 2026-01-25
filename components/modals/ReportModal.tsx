'use client'

import React from 'react';

interface ReportModalProps {
  reportingPost: any | null;
  reportReason: string;
  isSubmittingReport: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

export const ReportModal = React.memo<ReportModalProps>(({
  reportingPost,
  reportReason,
  isSubmittingReport,
  onClose,
  onReasonChange,
  onSubmit,
}) => {
  if (!reportingPost) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>ລາຍງານໂພສ</h3>
        <p style={{ fontSize: '14px', color: '#65676b', marginBottom: '10px' }}>ກະລຸນາລະບຸສາເຫດ:</p>
        <textarea 
          value={reportReason} 
          onChange={(e) => onReasonChange(e.target.value)} 
          placeholder="ພິມລາຍລະອຽດ..." 
          style={{ 
            width: '100%', 
            height: '100px', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid #ddd', 
            fontSize: '14px', 
            marginBottom: '20px', 
            outline: 'none' 
          }} 
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onClose} 
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid #ddd', 
              background: '#f0f2f5', 
              fontWeight: 'bold' 
            }}
          >
            ຍົກເລີກ
          </button>
          <button 
            onClick={onSubmit} 
            disabled={isSubmittingReport} 
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '8px', 
              border: 'none', 
              background: '#1877f2', 
              color: '#fff', 
              fontWeight: 'bold', 
              opacity: isSubmittingReport ? 0.6 : 1 
            }}
          >
            {isSubmittingReport ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລາຍງານ'}
          </button>
        </div>
      </div>
    </div>
  );
});

ReportModal.displayName = 'ReportModal';
