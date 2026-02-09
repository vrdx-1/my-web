'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  })

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage({ text: '', type: '' })

    if (!email.trim()) {
      setMessage({ text: 'ກະລຸນາປ້ອນອີເມວຂອງທ່ານ', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())

      if (error) {
        setMessage({
          text: 'ບໍ່ສາມາດສົ່ງລະຫັດໄດ້ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ',
          type: 'error',
        })
      } else {
        // ຈຳອີເມວໄວ້ໃນ localStorage ເພື່ອໃຊ້ໃນຂັ້ນຕອນກວດ OTP ແລະຕັ້ງລະຫັດໃໝ່
        if (typeof window !== 'undefined') {
          localStorage.setItem('password_reset_email', email.trim())
        }
        router.push('/reset-password-otp')
      }
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
          ລືມລະຫັດຜ່ານ
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#65676b',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          ໃສ່ອີເມວທີ່ທ່ານໃຊ້ລົງທະບຽນ ລະບົບຈະສົ່ງ OTP ໄປໃຫ້ທ່ານ
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

        <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ອີເມວຂອງທ່ານ"
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
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#e4e6eb' : '#1877f2',
              color: loading ? '#000' : '#fff',
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
              'ສົ່ງ OTP'
            )}
          </button>
        </form>

      </div>
    </main>
  )
}

