'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChangePassword() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState(''); // เพิ่ม State สำหรับรหัสเดิม
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    // 1. ตรวจสอบเบื้องต้น
    if (newPassword.length < 6) {
      setMessage({ text: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'ລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ', type: 'error' });
      return;
    }

    setLoading(true);

    // 2. ตรวจสอบรหัสผ่านเดิมก่อน (Re-authentication)
    // ดึงอีเมลของผู้ใช้ปัจจุบันมาเพื่อใช้ยืนยัน
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        setMessage({ text: 'ລະຫັດຜ່ານເດີມບໍ່ຖືກຕ້ອງ', type: 'error' });
        setLoading(false);
        return;
      }
    }

    // 3. ถ้าผ่านแล้ว จึงเรียกใช้ API เพื่อเปลี่ยนรหัสผ่านใหม่
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage({ text: 'ເກີດຂໍ້ຜິດພາດ: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: 'ປ່ຽນລະຫັດຜ່ານສຳເລັດແລ້ວ!', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    }

    setLoading(false);
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <div style={{ padding: '20px 15px 10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #ddd' }}>
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '0', position: 'absolute', left: '15px' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ປ່ຽນລະຫັດຜ່ານ</h1>
      </div>

      <div style={{ padding: '25px 20px' }}>
        <form onSubmit={handleChangePassword}>
          
          {message.text && (
            <div style={{ 
              padding: '12px', 
              borderRadius: '10px', 
              marginBottom: '20px', 
              fontSize: '14px',
              textAlign: 'center',
              background: message.type === 'success' ? '#e7f3ff' : '#fff0f0',
              color: message.type === 'success' ? '#1877f2' : '#ff4d4f',
              border: `1px solid ${message.type === 'success' ? '#1877f2' : '#ff4d4f'}`
            }}>
              {message.text}
            </div>
          )}

          {/* ช่องรหัสผ่านเดิม */}
          <div style={{ marginBottom: '20px' }}>
            <input 
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="ລະຫັດຜ່ານເກົ່າ"
              required
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: 'none', 
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#e0e0e0'
              }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', marginBottom: '20px' }} />

          <div style={{ marginBottom: '20px' }}>
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="ລະຫັດຜ່ານໃໝ່"
              required
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: 'none', 
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#e0e0e0'
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <input 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="ຢືນຢັນລະຫັດຜ່ານໃໝ່"
              required
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: 'none', 
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#e0e0e0'
              }}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: loading ? '#bcc0c4' : '#1877f2', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '12px', 
              fontWeight: 'bold', 
              fontSize: '16px', 
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s'
            }}
          >
            {loading ? 'ກຳລັງກວດສອບ...' : 'ບັນທຶກ'}
          </button>

        </form>
      </div>
    </main>
  );
}
