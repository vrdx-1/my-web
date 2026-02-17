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
      <button type="button" onClick={() => onOAuth('google')} style={buttonStyle}>
        <span style={{ width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '16px', height: '16px' }} />
        </span>
        <span>{googleLabel}</span>
      </button>
    </div>
  )
}
