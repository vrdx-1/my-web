'use client'

import React, { useEffect } from 'react';

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

  // จำกัดข้อความไม่เกิน 6 แถว
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const lines = value.split('\n');
    
    // ถ้ามีมากกว่า 6 แถว ให้ตัดเหลือแค่ 6 แถว
    if (lines.length > 6) {
      const limitedValue = lines.slice(0, 6).join('\n');
      onReasonChange(limitedValue);
    } else {
      onReasonChange(value);
    }
  };

  // ปิด modal เมื่อเลื่อนหน้าจอ (แต่ไม่ปิดเมื่อ scroll ใน textarea)
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // ไม่ปิด modal ถ้า scroll เกิดขึ้นใน textarea
      if (target?.tagName === 'TEXTAREA') {
        return;
      }
      onClose();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <div 
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div 
        style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>ລາຍງານໂພສ</h3>
        <textarea 
          value={reportReason} 
          onChange={handleTextChange}
          onKeyDown={(e) => {
            // ป้องกันการกด Enter เมื่อถึงแถวที่ 6 แล้ว
            const lines = reportReason.split('\n');
            if (e.key === 'Enter' && lines.length >= 6) {
              e.preventDefault();
            }
          }}
          placeholder="ຄຳອະທິບາຍ…" 
          rows={6}
          style={{ 
            width: '100%', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid #ddd', 
            fontSize: '14px', 
            lineHeight: '20px',
            marginBottom: '20px', 
            outline: 'none',
            resize: 'none',
            overflowY: 'hidden'
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
