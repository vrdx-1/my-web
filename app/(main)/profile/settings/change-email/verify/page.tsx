'use client'
import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { LAO_FONT } from '@/utils/constants';
import { PROFILE_PATH } from '@/utils/authRoutes';
import { OtpInputs } from '@/components/auth';
import { useOtpResendCountdown } from '@/hooks/useOtpResendCountdown';

function ChangeEmailVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newEmail = searchParams.get('email') || '';

  const [oldEmail, setOldEmail] = useState('');
  const [oldOtp, setOldOtp] = useState('');
  const [newOtp, setNewOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(true);
  const [resendTrigger, setResendTrigger] = useState(0);
  const resendSeconds = useOtpResendCountdown(otpSent, resendTrigger);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({
    text: '',
    type: '',
  });

  useEffect(() => {
    if (!newEmail) {
      router.push('/profile/settings/change-email');
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const email = session?.user?.email ?? '';
      if (email) setOldEmail(email);
    });
    return () => {
      cancelled = true;
    };
  }, [newEmail]);

  const verifyBothOtps = async (oldCode: string, newCode: string) => {
    if (loading) return;
    if (!oldCode.trim() || oldCode.trim().length !== 6 || !newCode.trim() || newCode.trim().length !== 6) {
      setMessage({ text: 'ກະລຸນາໃສ່ OTP 6 ຕົວຈາກອີເມລເກົ່າ ແລະ ອີເມລໃໝ່', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    // Verify OTP ของอีเมลเก่าก่อน
    const { error: oldError } = await supabase.auth.verifyOtp({
      email: oldEmail.trim(),
      token: oldCode.trim(),
      type: 'email_change',
    });
    if (oldError) {
      setMessage({ text: 'OTP ທີ່ສົ່ງໄປຫາອີເມລເກົ່າບໍ່ຖືກຕ້ອງ', type: 'error' });
      setOldOtp('');
      setLoading(false);
      return;
    }

    // Verify OTP ของอีเมลใหม่
    const { error: newError } = await supabase.auth.verifyOtp({
      email: newEmail.trim(),
      token: newCode.trim(),
      type: 'email_change',
    });
    if (newError) {
      setMessage({ text: 'OTP ທີ່ສົ່ງໄປຫາອີເມລໃໝ່ບໍ່ຖືກຕ້ອງ', type: 'error' });
      setNewOtp('');
      setLoading(false);
      return;
    }

    // Supabase จะเปลี่ยนอีเมลให้โดยอัตโนมัติเมื่อ verify ครบทั้งสองอัน
    setLoading(false);
    setShowSuccessModal(true);
  };

  const handleOldOtpChange = (value: string) => {
    setOldOtp(value);
    if (value.trim().length === 6 && newOtp.trim().length === 6) {
      verifyBothOtps(value, newOtp);
    }
  };

  const handleNewOtpChange = (value: string) => {
    setNewOtp(value);
    if (value.trim().length === 6 && oldOtp.trim().length === 6) {
      verifyBothOtps(oldOtp, value);
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendSeconds > 0 || !newEmail) return;
    setLoading(true);
    setMessage({ text: '', type: '' });

    // ใช้ email change flow อีกครั้งเพื่อส่ง OTP ใหม่ไปทั้งสองอีเมล
    const { error: resendError } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (resendError) {
      const raw = resendError.message || '';
      const text =
        raw === 'A user with this email address has already been registered'
          ? 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້, ມີຜູ້ໃຊ້ທີ່ໃຊ້ອີເມລນີ້ລົງທະບຽນແລ້ວ'
          : 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້: ' + raw;
      setMessage({ text, type: 'error' });
      setLoading(false);
      return;
    }

    setOldOtp('');
    setNewOtp('');
    setResendTrigger((t) => t + 1);
    setLoading(false);
  };

  if (!newEmail) {
    return null;
  }

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

        {/* OTP อีเมลเก่า */}
        <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: '8px' }}>
          ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {oldEmail || 'ອີເມລເກົ່າ'}
        </p>
        <div style={{ marginBottom: '16px' }}>
          <OtpInputs
            value={oldOtp}
            onChange={handleOldOtpChange}
            disabled={loading}
          />
        </div>

        {/* OTP อีเมลใหม่ */}
        <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: '8px' }}>
          ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {newEmail}
        </p>
        <div style={{ marginBottom: '8px' }}>
          <OtpInputs
            value={newOtp}
            onChange={handleNewOtpChange}
            disabled={loading}
          />
        </div>

        <button
          type="button"
          onClick={handleResendOtp}
          disabled={loading || resendSeconds > 0}
          style={{
            background: 'none',
            border: 'none',
            color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2',
            fontSize: '14px',
            cursor: resendSeconds > 0 ? 'default' : 'pointer',
            marginTop: 4,
            alignSelf: 'center',
            width: '100%',
            textAlign: 'center',
          }}
        >
          ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
        </button>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
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
              background: '#ffffff',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
              ປ່ຽນອີເມລສຳເລັດ
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                router.push(PROFILE_PATH);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#1877f2',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ຕົກລົງ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ChangeEmailVerify() {
  return (
    <Suspense fallback={null}>
      <ChangeEmailVerifyContent />
    </Suspense>
  );
}
