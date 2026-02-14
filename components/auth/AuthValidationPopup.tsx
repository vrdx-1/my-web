'use client'

import React from 'react'

export interface AuthValidationPopupProps {
  show: boolean
  message: string
  onClose: () => void
  /** ข้อความปุ่ม (default ຕົກລົງ) */
  buttonText?: string
}

/**
 * ป๊อปอัปแจ้งเตือน validation — ใช้ร่วมกันทั้งหน้าลงทะเบียนและหน้าเข้าสู่ระบบ
 */
export function AuthValidationPopup({
  show,
  message,
  onClose,
  buttonText = 'ຕົກລົງ',
}: AuthValidationPopupProps) {
  if (!show) return null
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
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#111111' }}>
          {message}
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
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
          {buttonText}
        </button>
      </div>
    </div>
  )
}
