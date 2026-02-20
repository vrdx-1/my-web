'use client'

import React, { useRef, useCallback } from 'react'

export interface OtpInputsProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
}

/**
 * ช่องกรอก OTP 6 หลัก — กล่องเดียว ด้านขวามีปุ่ม "ວາງ" ให้ผู้ใช้ paste OTP ได้
 * ใช้ร่วมกันทั้งหน้าลงทะเบียน, เข้าสู่ระบบ และเปลี่ยนอีเมล
 */
export const OtpInputs = React.memo(function OtpInputs({
  value,
  onChange,
  onComplete,
  disabled = false,
}: OtpInputsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const applyPastedText = useCallback(
    (text: string) => {
      const pasted = text.replace(/\D/g, '').slice(0, 6)
      if (pasted.length > 0) {
        onChange(pasted)
        if (pasted.trim().length === 6 && onComplete) onComplete(pasted.trim())
        inputRef.current?.focus()
      }
    },
    [onChange, onComplete],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(next)
    if (next.trim().length === 6 && onComplete) onComplete(next.trim())
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    applyPastedText(e.clipboardData.getData('text'))
  }

  const handlePasteButtonClick = useCallback(() => {
    if (disabled) return
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      navigator.clipboard.readText().then(applyPastedText).catch(() => {})
    } else {
      inputRef.current?.focus()
    }
  }, [disabled, applyPastedText])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: '10px',
          border: '1px solid #ddd',
          background: '#f9f9f9',
          paddingLeft: '12px',
          paddingRight: '10px',
          minHeight: '44px',
          boxSizing: 'border-box',
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder=""
          style={{
            width: '11ch',
          border: 'none',
          background: 'transparent',
          fontSize: '18px',
          fontWeight: 'bold',
          outline: 'none',
          color: '#111111',
          padding: '8px 0',
          minWidth: 0,
        }}
        />
        <button
          type="button"
          onClick={handlePasteButtonClick}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            padding: '6px 4px',
            fontSize: '14px',
            color: '#1877f2',
            cursor: disabled ? 'default' : 'pointer',
            flexShrink: 0,
            fontWeight: 500,
          }}
        >
          ວາງ
        </button>
      </div>
    </div>
  )
})
