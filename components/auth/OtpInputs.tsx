'use client'

import React, { useRef } from 'react'

const inputStyle: React.CSSProperties = {
  width: '44px',
  height: '52px',
  padding: 0,
  borderRadius: '12px',
  border: '1px solid #ddd',
  background: '#f9f9f9',
  fontSize: '20px',
  fontWeight: 'bold',
  outline: 'none',
  color: '#111111',
  textAlign: 'center',
}

export interface OtpInputsProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
}

/**
 * ช่องกรอก OTP 6 หลัก — ใช้ร่วมกันทั้งหน้าลงทะเบียนและหน้าเข้าสู่ระบบ
 */
export const OtpInputs = React.memo(function OtpInputs({
  value,
  onChange,
  onComplete,
  disabled = false,
}: OtpInputsProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (i: number, v: string) => {
    const next = (value.slice(0, i) + v + value.slice(i + 1)).slice(0, 6)
    onChange(next)
    if (next.trim().length === 6 && onComplete) onComplete(next.trim())
    else if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      onChange(value.slice(0, i - 1) + value.slice(i))
      refs.current[i - 1]?.focus()
    } else if (e.key === 'Backspace' && value[i]) {
      onChange(value.slice(0, i) + value.slice(i + 1))
    }
  }

  const handlePaste = (i: number, e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const next = (value.slice(0, i) + pasted).slice(0, 6)
      onChange(next)
      if (next.trim().length === 6 && onComplete) onComplete(next.trim())
      else refs.current[Math.min(i + pasted.length, 5)]?.focus()
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          style={inputStyle}
        />
      ))}
    </div>
  )
})
