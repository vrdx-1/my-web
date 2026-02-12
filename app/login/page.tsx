'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { safeParseJSON } from '@/utils/storageUtils'
import { LAO_FONT } from '@/utils/constants'
import { ErrorPopup } from '@/components/modals/ErrorPopup'
import { ButtonSpinner } from '@/components/LoadingSpinner'

export default function Login() {
  type SavedAccount = { email: string; last_used_at: string }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(true) // ไม่ใช้แล้ว (คง state ไว้เพื่อไม่กระทบ logic อื่น)
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
  const [showForm, setShowForm] = useState(false)
  const [hideSavedAccounts, setHideSavedAccounts] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(60)
  const router = useRouter()
  const [otpValue, setOtpValue] = useState('')
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null)

  useEffect(() => {
    const stored = safeParseJSON<SavedAccount[]>('saved_login_accounts', [])
    setSavedAccounts(stored)
    if (stored.length === 0) {
      setShowForm(true)
      setHideSavedAccounts(false)
    }
  }, [])

  // นับเวลาถอยหลัง 60 วิ สำหรับปุ่มສົ່ງ OTP ໃໝ່ (ถ้าอยากเพิ่มในอนาคต)
  useEffect(() => {
    if (!otpSent) return
    setResendSeconds(60)
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpSent])

  const handleSelectAccount = (acc: SavedAccount) => {
    setEmail(acc.email)
    setShowForm(true)
    setTimeout(() => {
      passwordInputRef.current?.focus()
    }, 0)
  }

  const handleRemoveAccount = (removeEmail: string) => {
    setSavedAccounts((prev) => {
      const next = prev.filter((a) => a.email !== removeEmail)
      if (typeof window !== 'undefined') {
        localStorage.setItem('saved_login_accounts', JSON.stringify(next))
      }
      return next
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // สั่งให้ Supabase ตรวจสอบอีเมลและรหัสผ่าน
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setShowErrorPopup(true)
      setLoading(false)
    } else {
      // บันทึกบัญชีที่เคย Login ไว้ในเครื่อง (จำอีเมลเหมือน TikTok)
      try {
        const existing = safeParseJSON<SavedAccount[]>('saved_login_accounts', [])
        const filtered = existing.filter((a) => a.email !== email.trim())
        const updated: SavedAccount[] = [
          { email: email.trim(), last_used_at: new Date().toISOString() },
          ...filtered,
        ].slice(0, 5)
        if (typeof window !== 'undefined') {
          localStorage.setItem('saved_login_accounts', JSON.stringify(updated))
        }
        setSavedAccounts(updated)
      } catch {
        // ถ้า localStorage พัง ให้ข้ามไปไม่ให้มีผลกับการ login
      }

      // ເມື່ອເຂົ້າສູ່ລະບົບສຳເລັດ ໃຫ້ໄປໜ້າ Home ທັນທີ
      router.push('/') 
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!email.trim()) {
      setOtpError('ກະລຸນາໃສ່ອີເມລ')
      return
    }
    setLoading(true)
    setOtpError('')
    setOtpSent(false)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })
      if (error) {
        if (error.message === 'Signups not allowed for otp') {
          setOtpError('ອີເມລນີ້ຍັງບໍ່ເຄີຍລົງທະບຽນ ກະລຸນາລົງທະບຽນກ່ອນ')
        } else {
          setOtpError(error.message || 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້')
        }
      } else {
        setOtpSent(true)
      }
    } catch {
      setOtpError('ບໍ່ສາມາດສົ່ງ OTP ໄດ້')
    }
    setLoading(false)
  }

  const verifyOtpCode = async (code: string) => {
    if (loading) return
    if (!code.trim()) {
      setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ')
      return
    }

    setLoading(true)
    setOtpError('')
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      if (error) {
        setOtpError(resendSeconds > 0 ? 'OTP ບໍ່ຖືກຕ້ອງ' : 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ')
        setOtpValue('')
        setLoading(false)
        return
      }
      const loggedInUser = data?.user
      if (!loggedInUser) {
        setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້')
        setOtpValue('')
        setLoading(false)
        return
      }

      // บันทึกบัญชีที่เคย Login ไว้ในเครื่อง (จำอีเมลเหมือนเดิม)
      try {
        const existing = safeParseJSON<SavedAccount[]>('saved_login_accounts', [])
        const filtered = existing.filter((a) => a.email !== email.trim())
        const updated: SavedAccount[] = [
          { email: email.trim(), last_used_at: new Date().toISOString() },
          ...filtered,
        ].slice(0, 5)
        if (typeof window !== 'undefined') {
          localStorage.setItem('saved_login_accounts', JSON.stringify(updated))
        }
        setSavedAccounts(updated)
      } catch {
        // ignore localStorage errors
      }

      router.push('/')
    } catch (_) {
      setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້')
      setOtpValue('')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    await verifyOtpCode(otpValue.trim())
  }

  const handleOAuthLogin = async (provider: 'facebook' | 'google') => {
    try {
      if (typeof window === 'undefined') return
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/register` },
      })
    } catch (err) {
      console.error('OAuth login error', err)
    }
  }

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT }}>
      
      {/* Header */}
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button 
          onClick={() => router.push('/profile')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px', position: 'absolute', left: '15px' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ເຂົ້າສູ່ລະບົບ</h1>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', paddingTop: '10px' }}>
          {/* รายการบัญชีที่เคยใช้ล็อกอิน */}
          {!otpSent && !hideSavedAccounts && savedAccounts.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ borderRadius: '16px', background: '#f0f2f5', padding: '8px 0' }}>
                {savedAccounts.map((acc, index) => (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectAccount(acc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      cursor: 'pointer',
                      borderTop: index === 0 ? 'none' : '1px solid #e0e0e0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '999px', background: '#d8dbe0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#4a4d52' }}>
                        {acc.email.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '15px', color: '#111111', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.email}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteEmail(acc.email)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#8d8f94',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14H6L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M9 6V4h6v2"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!otpSent && showForm && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: savedAccounts.length > 0 ? 0 : 10 }}>
            <input 
              type="email" 
              placeholder="ອີເມລ" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', outline: 'none', fontSize: '16px', color: '#111111' }}
              required
            />
            {otpError && (
              <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '15px', 
                background: '#1877f2', 
                color: 'white', 
                border: 'none', 
                borderRadius: '12px', 
                fontSize: '18px', 
                fontWeight: 'bold', 
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '30px'
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <ButtonSpinner />
                </span>
              ) : 'ສົ່ງ OTP'}
            </button>

            {otpSent && !otpError && (
              <p style={{ fontSize: '13px', color: '#65676b', marginTop: '10px', textAlign: 'center' }}>
                ພວກເຮົາໄດ້ສົ່ງ OTP ຫຼືລິ້ງເຂົ້າສູ່ລະບົບໄປທີ່ອີເມລ {email} ແລ້ວ
              </p>
            )}
          </form>
          )}

          {otpSent && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: 20 }}>
              <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: '8px' }}>
                ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {email}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpValue[i] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(-1)
                      const next = (otpValue.slice(0, i) + v + otpValue.slice(i + 1)).slice(0, 6)
                      setOtpValue(next)
                      const code = next.trim()
                      if (code.length === 6) {
                        void verifyOtpCode(code)
                      } else if (v && i < 5) {
                        otpInputRefs.current[i + 1]?.focus()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otpValue[i] && i > 0) {
                        setOtpValue((prev) => prev.slice(0, i - 1) + prev.slice(i))
                        otpInputRefs.current[i - 1]?.focus()
                      } else if (e.key === 'Backspace' && otpValue[i]) {
                        setOtpValue((prev) => prev.slice(0, i) + prev.slice(i + 1))
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault()
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                      if (pasted.length > 0) {
                        const next = (otpValue.slice(0, i) + pasted).slice(0, 6)
                          setOtpValue(next)
                          const code = next.trim()
                          if (code.length === 6) {
                            void verifyOtpCode(code)
                          } else {
                            const focusIdx = Math.min(i + pasted.length, 5)
                            otpInputRefs.current[focusIdx]?.focus()
                          }
                      }
                    }}
                    style={{
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
                    }}
                  />
                ))}
              </div>
              {otpError && (
                <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>
              )}
              <button 
                type="button"
                onClick={async () => {
                  if (resendSeconds > 0 || loading) return
                  setLoading(true)
                  setOtpError('')
                  try {
                    const { error } = await supabase.auth.signInWithOtp({
                      email: email.trim(),
                      options: { shouldCreateUser: false },
                    })
                    if (error) {
                      if (error.message === 'Signups not allowed for otp') {
                        setOtpError('ອີເມລນີ້ຍັງບໍ່ເຄີຍລົງທະບຽນ ກະລຸນາລົງທະບຽນກ່ອນ')
                      } else {
                        setOtpError(error.message || 'ບໍ່ສາມາດສົ່ງ OTP ໃໝ່ໄດ້')
                      }
                    } else {
                      setOtpValue('')
                      setResendSeconds(60)
                    }
                  } catch {
                    setOtpError('ບໍ່ສາມາດສົ່ງ OTP ໃໝ່ໄດ້')
                  }
                  setLoading(false)
                }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2', 
                  fontSize: '14px', 
                  cursor: resendSeconds > 0 ? 'default' : 'pointer', 
                  marginTop: '4px',
                  alignSelf: 'center'
                }}
              >
                ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
              </button>
            </form>
          )}

          {!otpSent && (
            <div style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                <span style={{ margin: '0 10px', fontSize: '13px', color: '#65676b' }}>ຫຼື</span>
                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('facebook')}
                  style={{
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
                  }}
                >
                  <span style={{ width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  <span>ເຂົ້າສູ່ລະບົບດ້ວຍ Facebook</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  style={{
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
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </span>
                  <span>ເຂົ້າສູ່ລະບົບດ້ວຍ Google</span>
                </button>
              </div>
            </div>
          )}

          {!otpSent && !hideSavedAccounts && savedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowForm(true)
                setHideSavedAccounts(true)
                setEmail('')
                setOtpError('')
                setOtpSent(false)
                setOtpValue('')
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '999px',
                border: '1px solid #e0e0e0',
                background: '#f9f9f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#111111',
                marginTop: '16px',
                marginBottom: '18px',
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              <span>ເຂົ້າບັນຊີອື່ນ</span>
            </button>
          )}
        </div>
      </div>

      {/* ยืนยันการลบบัญชีเก่าที่จำไว้ */}
      {confirmDeleteEmail && (
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
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '20px',
                textAlign: 'center',
                color: '#111111',
              }}
            >
              ທ່ານຕ້ອງການລົບບັນຊີນີ້ອອກບໍ
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteEmail(null)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: 'pointer',
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteEmail) {
                    handleRemoveAccount(confirmDeleteEmail)
                  }
                  setConfirmDeleteEmail(null)
                }}
                style={{
                  flex: 1,
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
                ລົບ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
