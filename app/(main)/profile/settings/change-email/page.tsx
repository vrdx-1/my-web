'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LAO_FONT } from '@/utils/constants';
import { PROFILE_PATH } from '@/utils/authRoutes';
export default function ChangeEmail() {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState('');
  const [oldEmailForOtp, setOldEmailForOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  });

  // ดึงอีเมลปัจจุบันมาแสดงในแท็บ "ອີເມລເກົ່າ" ทันทีที่เข้าเพจ
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || '';
        if (!cancelled && email) {
          setOldEmailForOtp(email);
        }
      } catch {
        // เงียบ error ไว้ ไม่กระทบ flow หลัก
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    // Step 1: ກອກອີເມລໃໝ່ แล้วให้ Supabase ส่ง OTP ໄປທັງອີເມລເກົ່າ ແລະ ອີເມລໃໝ່ (flow email_change)
    const trimmedNewEmail = newEmail.trim();

    if (!trimmedNewEmail) {
      setMessage({ text: 'ກະລຸນາກອກອີເມລໃໝ່', type: 'error' });
      return;
    }

    // ตรวจสอบรูปแบบอีเมลแบบง่าย
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedNewEmail)) {
      setMessage({ text: 'ຮູບແບບອີເມລບໍ່ຖືກຕ້ອງ', type: 'error' });
      return;
    }

    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      setMessage({ text: 'ບໍ່ສາມາດດຶງຂໍ້ມູນຜູ້ໃຊ້ໄດ້', type: 'error' });
      setLoading(false);
      return;
    }

    if (trimmedNewEmail.toLowerCase() === (user.email || '').toLowerCase()) {
      setMessage({ text: 'ອີເມລໃໝ່ຕ້ອງແຕກຕ່າງຈາກອີເມລເກົ່າ', type: 'error' });
      setLoading(false);
      return;
    }

    // ใช้ email change flow ของ Supabase: ส่ง OTP ໄປທັງອີເມລເກົ່າ ແລະ ອີເມລໃໝ່
    const { error } = await supabase.auth.updateUser({ email: trimmedNewEmail });
    if (error) {
      const raw = error.message || '';
      const text =
        raw === 'A user with this email address has already been registered'
          ? 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້, ມີຜູ້ໃຊ້ທີ່ໃຊ້ອີເມລນີ້ລົງທະບຽນແລ້ວ'
          : 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້: ' + raw;
      setMessage({ text, type: 'error' });
      setLoading(false);
      return;
    }

    // Redirect ไปหน้า verify OTP (เหมือนตอนเข้าสู่ระบบ)
    router.push(`/profile/settings/change-email/verify?email=${encodeURIComponent(trimmedNewEmail)}`);
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT }}>

      <div style={{ padding: '20px 15px 10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 100, borderBottom: '1px solid #ddd' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '0', position: 'absolute', left: '15px' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ປ່ຽນອີເມລ</h1>
      </div>

      <div style={{ padding: '25px 20px' }}>
        <form onSubmit={handleSubmit}>

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

          {/* แท็บອີເມລເກົ່າ */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '13px', color: '#65676b', marginBottom: '4px' }}>ອີເມລເກົ່າ</div>
            <div
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: '#e0e0e0',
                color: '#111111',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            >
              {oldEmailForOtp || '—'}
            </div>
          </div>

          {/* แท็บອີເມລໃໝ່ + ช่องกรอก */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#65676b', marginBottom: '4px' }}>ອີເມລໃໝ່</div>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ອີເມລໃໝ່"
              required
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#e0e0e0',
                color: '#111111'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#bcc0c4' : '#1877f2',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s',
              marginTop: '4px',
            }}
          >
            {loading ? 'ກຳລັງສົ່ງ OTP...' : 'ສົ່ງ OTP'}
          </button>

        </form>
      </div>
    </main>
  );
}
