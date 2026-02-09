'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'

export default function ResetPassword() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(true)
  const [showConfirmPassword, setShowConfirmPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  })

  // ປ້ອງກັນການເຂົ້າໜ້ານີ້ໂດຍບໍ່ຜ່ານຂັ້ນຕອນ OTP
  useEffect(() => {
    if (typeof window === 'undefined') return
    const verified = localStorage.getItem('password_reset_verified')
    if (verified !== 'true') {
      router.replace('/forgot-password')
    }
  }, [router])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage({ text: '', type: '' })

    if (newPassword.length < 6) {
      setMessage({
        text: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ',
        type: 'error',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({
        text: 'ລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ',
        type: 'error',
      })
      return
    }

    setLoading(true)
    try {
      // ຕັ້ງລະຫັດຜ່ານໃໝ່ (ຜູ້ໃຊ້ຖືກຢືນຢັນແລ້ວຈາກຂັ້ນຕອນ OTP)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setMessage({
          text: 'ບໍ່ສາມາດປ່ຽນລະຫັດຜ່ານໄດ້ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ',
          type: 'error',
        })
        return
      }

      setMessage({
        text: 'ປ່ຽນລະຫັດຜ່ານສຳເລັດແລ້ວ! ກຳລັງເຂົ້າສູ່ບັນຊີຂອງທ່ານ',
        type: 'success',
      })

      if (typeof window !== 'undefined') {
        localStorage.removeItem('password_reset_email')
        localStorage.removeItem('password_reset_verified')
      }

      setTimeout(() => {
        router.push('/')
      }, 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '15px 15px 5px 15px',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 100,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1c1e21',
            padding: '10px',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
            textAlign: 'center',
            color: '#1c1e21',
          }}
        >
          ຕັ້ງລະຫັດຜ່ານໃໝ່
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#65676b',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          ຕັ້ງລະຫັດຜ່ານໃໝ່ສຳລັບບັນຊີຂອງທ່ານ
        </p>

        {message.text && (
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              textAlign: 'center',
              background: message.type === 'success' ? '#e7f3ff' : '#fff0f0',
              color: message.type === 'success' ? '#1877f2' : '#ff4d4f',
              border: `1px solid ${message.type === 'success' ? '#1877f2' : '#ff4d4f'}`,
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="ລະຫັດຜ່ານໃໝ່"
              required
              style={{
                width: '100%',
                padding: '15px 45px 15px 15px',
                borderRadius: '12px',
                border: '1px solid #ddd',
                background: '#f9f9f9',
                outline: 'none',
                fontSize: '16px',
                color: '#111111',
              }}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px',
              }}
            >
              {showNewPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a4d52"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a4d52"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              )}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="ຢືນຢັນລະຫັດຜ່ານໃໝ່"
              required
              style={{
                width: '100%',
                padding: '15px 45px 15px 15px',
                borderRadius: '12px',
                border: '1px solid #ddd',
                background: '#f9f9f9',
                outline: 'none',
                fontSize: '16px',
                color: '#111111',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px',
              }}
            >
              {showConfirmPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a4d52"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a4d52"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#e4e6eb' : '#1877f2',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ButtonSpinner />
              </span>
            ) : (
              'ຢືນຢັນການປ່ຽນລະຫັດຜ່ານ'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}

