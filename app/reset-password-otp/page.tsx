'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'

export default function ResetPasswordOtp() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  })

  // ດຶງອີເມວຈາກ localStorage ຖ້າບໍ່ມີໃຫ້ກັບໄປໜ້າຂໍ OTP
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedEmail = localStorage.getItem('password_reset_email')
    if (!storedEmail) {
      router.replace('/forgot-password')
      return
    }
    setEmail(storedEmail)
  }, [router])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage({ text: '', type: '' })

    if (!token.trim()) {
      setMessage({ text: 'ກະລຸນາປ້ອນ OTP ທີ່ໄດ້ຮັບ', type: 'error' })
      return
    }

    if (!email) {
      setMessage({ text: 'ຂໍ້ມູນອີເມວບໍ່ຖືກຕ້ອງ ກະລຸນາຂໍ OTP ໃໝ່', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: 'recovery',
      })

      if (error) {
        setMessage({
          text: 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ ກະລຸນາລອງໃໝ່',
          type: 'error',
        })
        return
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('password_reset_verified', 'true')
      }
      router.push('/reset-password')
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
          ຢືນຢັນ OTP
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#65676b',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          ໃສ່ OTP ທີ່ໄດ້ຮັບຈາກອີເມວເພື່ອດຳເນີນການຕໍ່
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

        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="OTP ຈາກອີເມວ"
            required
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid #ddd',
              background: '#f9f9f9',
              outline: 'none',
              fontSize: '16px',
              color: '#111111',
              textAlign: 'center',
              letterSpacing: '3px',
            }}
          />

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
              'ຢືນຢັນ OTP'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}

