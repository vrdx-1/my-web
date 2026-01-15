'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
        const storedPosts = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
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
          {loading ? 'ກຳລັງໂຫລດ...' : 'ເຂົ້າສູ່ລະບົບ'}
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
