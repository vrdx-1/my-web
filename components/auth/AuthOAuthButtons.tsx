'use client'

import React from 'react'

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '999px',
  border: 'none',
  background: '#f0f2f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#111111',
}

export type AuthOAuthProvider = 'facebook' | 'google'

export interface AuthOAuthButtonsProps {
  /** redirectTo หลัง OAuth สำเร็จ (เช่น /profile สำหรับลงทะเบียน, / สำหรับเข้าสู่ระบบ) */
  redirectTo: string
  onOAuth: (provider: AuthOAuthProvider) => void
  /** ข้อความปุ่ม เช่น "ລົງທະບຽນດ້ວຍ Facebook" หรือ "ເຂົ້າສູ່ລະບົບດ້ວຍ Facebook" */
  facebookLabel: string
  googleLabel: string
}

/**
 * ปุ่ม OAuth (Facebook, Google) — ใช้ร่วมกันทั้งหน้าลงทะเบียนและหน้าเข้าสู่ระบบ
 */
export function AuthOAuthButtons({
  redirectTo,
  onOAuth,
  facebookLabel,
  googleLabel,
}: AuthOAuthButtonsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button type="button" onClick={() => onOAuth('facebook')} style={buttonStyle}>
        <span style={{ width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </span>
        <span>{facebookLabel}</span>
      </button>
      <button type="button" onClick={() => onOAuth('google')} style={buttonStyle}>
        <span style={{ width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '16px', height: '16px' }} />
        </span>
        <span>{googleLabel}</span>
      </button>
    </div>
  )
}
