import React from 'react';

/** Overlay "+N" บนรูปสุดท้ายเมื่อมีรูปมากกว่าที่แสดง — สไตล์ Facebook */
const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#fff',
  WebkitTextStroke: '3px #000',
  paintOrder: 'stroke fill',
  pointerEvents: 'none',
  zIndex: 1,
};

export function PhotoOverlayBadge({ remaining }: { remaining: number }) {
  return <div style={overlayStyle}>+{remaining}</div>;
}
