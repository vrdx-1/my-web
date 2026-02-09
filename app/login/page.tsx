'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { safeParseJSON } from '@/utils/storageUtils'
import { LAO_FONT } from '@/utils/constants'
import { ErrorPopup } from '@/components/modals/ErrorPopup'
import { ButtonSpinner } from '@/components/LoadingSpinner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(true) // Default แสดงรหัสผ่าน
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const router = useRouter()

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
      // --- จุดที่เพิ่ม: ระบบโอนย้ายข้อมูลจาก Guest ไปยังบัญชีที่ Login ---
      const loggedInUser = data.user;
      if (loggedInUser) {
        const storedPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
        const deviceToken = localStorage.getItem('device_guest_token');
        
        const guestTokens = Array.from(new Set([
          ...storedPosts.map((p: any) => p.token),
          deviceToken
        ].filter(t => t !== null)));

        if (guestTokens.length > 0) {
          try {
            for (const token of guestTokens) {
              // โอนย้ายข้อมูลทุกอย่างที่เคยทำไว้ตอนเป็น Guest มาเป็นของ User ID นี้
              await supabase.from('cars').update({ user_id: loggedInUser.id }).eq('user_id', token);
              await supabase.from('liked_posts').update({ user_id: loggedInUser.id }).eq('user_id', token);
              await supabase.from('saved_posts').update({ user_id: loggedInUser.id }).eq('user_id', token);
              await supabase.from('profiles').update({ id: loggedInUser.id }).eq('id', token);
            }
            // ล้าง Token ชั่วคราวออกจากเครื่อง
            localStorage.removeItem('my_guest_posts');
            localStorage.removeItem('device_guest_token');
          } catch (migrateError) {
            console.error("Migration error during login:", migrateError);
          }
        }
      }
      // -------------------------------------------------------

      // ເມື່ອເຂົ້າສູ່ລະບົບສຳເລັດ ໃຫ້ໄປໜ້າ Home ທັນທີ
      router.push('/') 
    }
  }

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT }}>
      
      {/* Header */}
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button 
          onClick={() => router.push('/profile')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', paddingTop: '10px' }}>
          {/* Logo Website */}
          <div style={{ width: '100px', height: '100px', margin: '0 auto 30px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #eee' }}>
            <img 
              src="https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/9a8595cc-bfa6-407d-94d4-67e2e82523e5/WhatsApp%20Image%202026-01-09%20at%2016.10.33%20(1).jpeg" 
              alt="Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="ອີເມລ" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', outline: 'none', fontSize: '16px', color: '#111111' }}
              required
            />
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="ລະຫັດຜ່ານ" 
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '15px 45px 15px 15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', outline: 'none', fontSize: '16px', color: '#111111' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                  padding: '5px'
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                )}
              </button>
            </div>

            {/* ລິ້ງສຳລັບຜູ້ໃຊ້ທີ່ລືມລະຫັດຜ່ານ */}
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              style={{
                alignSelf: 'flex-end',
                marginTop: '4px',
                marginBottom: '4px',
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#1877f2',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              ລືມລະຫັດຜ່ານ?
            </button>

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
              ) : 'ເຂົ້າສູ່ລະບົບ'}
            </button>
          </form>
        </div>
      </div>

      {/* Error Popup */}
      {showErrorPopup && (
        <ErrorPopup 
          message="ອີເມລ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" 
          onClose={() => setShowErrorPopup(false)} 
        />
      )}
    </main>
  )
}
