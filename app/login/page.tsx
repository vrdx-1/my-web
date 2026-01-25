'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { safeParseJSON } from '@/utils/storageUtils'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
      alert('ອີເມລ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ: ' + error.message)
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

      alert('ເຂົ້າສູ່ລະບົບສຳເລັດ!')
      // ເມື່ອເຂົ້າສູ່ລະບົບສຳເລັດ ໃຫ້ໄປໜ້າ Home ທັນທີ
      router.push('/') 
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '450px', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      
      {/* ປຸ່ມກັບຄືນ */}
      <button 
        onClick={() => router.back()} 
        style={{ position: 'fixed', top: '20px', left: '20px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#65676b' }}
      >
        ✕
      </button>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1877f2', marginBottom: '10px' }}>Pidjob</h1>
        <p style={{ color: '#1c1e21', fontSize: '18px', fontWeight: '500' }}>ເຂົ້າສູ່ລະບົບ</p>
      </div>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '12px' }}>
          <input 
            type="email" 
            placeholder="ອີເມລ ຫຼື ເບີໂທລະສັບ" 
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', outline: 'none', fontSize: '16px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="password" 
            placeholder="ລະຫັດຜ່ານ" 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', outline: 'none', fontSize: '16px' }}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#1877f2', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '20px', 
            fontWeight: 'bold', 
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.loading-spinner-circle-btn { display: inline-block; width: 20px; height: 20px; position: relative; }
.loading-spinner-circle-btn div { position: absolute; width: 4px; height: 4px; border-radius: 50%; top: 0; left: 50%; margin-left: -2px; transform-origin: 2px 10px; background: currentColor; animation: fadeColor 1s linear infinite; opacity: 0.8; }
.loading-spinner-circle-btn div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.loading-spinner-circle-btn div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.loading-spinner-circle-btn div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.loading-spinner-circle-btn div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.loading-spinner-circle-btn div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.loading-spinner-circle-btn div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.loading-spinner-circle-btn div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.loading-spinner-circle-btn div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
`}</style>
              <span className="loading-spinner-circle-btn"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></span>
            </span>
          ) : 'ເຂົ້າສູ່ລະບົບ'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <a href="#" style={{ color: '#1877f2', textDecoration: 'none', fontSize: '14px' }}>ລືມລະຫັດຜ່ານແມ່ນບໍ່?</a>
      </div>

      <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #ddd', margin: '30px 0' }} />

      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => router.push('/register')}
          style={{ 
            padding: '12px 20px', 
            background: '#42b72a', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}
        >
          ສ້າງບັນຊີໃໝ່
        </button>
      </div>
    </div>
  )
}
