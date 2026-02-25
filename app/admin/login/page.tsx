'use client'
import { useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useOtpResendCountdown } from '@/hooks/useOtpResendCountdown';
import { OtpInputs } from '@/components/auth';
import { sendOtpToEmail } from '@/utils/authOtp';
import { ButtonSpinner } from '@/components/LoadingSpinner';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [resendTrigger, setResendTrigger] = useState(0);
  const resendSeconds = useOtpResendCountdown(otpSent, resendTrigger);
  const router = useRouter();

  // สร้าง supabase client สำหรับ Browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSendOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) {
      if (!email.trim()) setOtpError('ກະລຸນາໃສ່ອີເມລ');
      return;
    }
    setLoading(true);
    setOtpError('');
    setOtpSent(false);
    const { error } = await sendOtpToEmail(email, false);
    if (error) setOtpError(error);
    else setOtpSent(true);
    setLoading(false);
  }, [email, loading]);

  const verifyOtpCode = useCallback(async (code: string) => {
    if (loading) return;
    if (!code.trim()) {
      setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      // ใช้ createBrowserClient เพื่อ verify OTP และ sync cookies
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });

      if (error) {
        setOtpError(resendSeconds > 0 ? 'OTP ບໍ່ຖືກຕ້ອງ' : 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ');
        setOtpValue('');
        setLoading(false);
        return;
      }
      if (!data?.user) {
        setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
        setOtpValue('');
        setLoading(false);
        return;
      }

      // รอให้ session ถูก set ใน cookies โดยตรวจสอบ session จริงๆ
      let sessionReady = false;
      for (let i = 0; i < 10; i++) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          sessionReady = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!sessionReady) {
        setOtpError('ບໍ່ສາມາດເຊື່ອມຕໍ່ໄດ້ ກະລຸນາລອງໃໝ່');
        setOtpValue('');
        setLoading(false);
        return;
      }

      // ກວດສອບສິດ Admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setOtpError('ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້');
        setOtpValue('');
        setLoading(false);
        return;
      }

      if (profile.role === 'admin') {
        // ໃຊ້ window.location ເພື່ອໃຫ້ Middleware ເຊັກຄ່າໃໝ່ໄດ້ຊັດເຈນ
        window.location.href = '/admin/search-history';
      } else {
        await supabase.auth.signOut();
        setOtpError('ບໍ່ມີສິດເຂົ້າເຖິງ');
        setOtpValue('');
        setLoading(false);
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
      setOtpValue('');
      setLoading(false);
    }
  }, [email, loading, resendSeconds, supabase]);

  const handleVerifyOtp = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpCode(otpValue.trim());
  }, [otpValue, verifyOtpCode]);

  const handleResendOtp = useCallback(async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setOtpError('');
    const { error } = await sendOtpToEmail(email, false);
    if (error) setOtpError(error);
    else {
      setOtpValue('');
      setResendTrigger((t) => t + 1);
    }
    setLoading(false);
  }, [email, loading, resendSeconds]);

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', fontSize: '16px' };
  const submitBtnStyle = { width: '100%', padding: '12px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '25px', fontWeight: 'bold' }}>Admin Login</h2>
        
        {!otpSent && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required
              style={inputStyle}
            />
            {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
            <button 
              type="submit" 
              disabled={loading}
              style={submitBtnStyle}
            >
              {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ButtonSpinner /></span> : 'ສົ່ງ OTP'}
            </button>
          </form>
        )}

        {otpSent && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: 8 }}>ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {email}</p>
            <OtpInputs value={otpValue} onChange={setOtpValue} onComplete={verifyOtpCode} disabled={loading} />
            {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendSeconds > 0 || loading}
              style={{
                background: 'none',
                border: 'none',
                color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2',
                fontSize: '14px',
                cursor: resendSeconds > 0 ? 'default' : 'pointer',
                marginTop: 4,
                alignSelf: 'center',
              }}
            >
              ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
