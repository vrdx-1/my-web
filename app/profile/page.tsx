'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeParseJSON } from '@/utils/storageUtils';
import { LAO_FONT } from '@/utils/constants';
import { ButtonSpinner, PageSpinner } from '@/components/LoadingSpinner';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  
  // Register State (OTP flow: ไม่ใช้รหัสผ่าน)
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // User Data State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      // ตรวจสอบข้อมูลที่ค้างอยู่ใน localStorage ทันทีที่โหลดหน้า
      const pendingData = safeParseJSON<{ email?: string; acceptedTerms?: boolean }>('pending_registration', {});
      if (pendingData.email) setEmail(pendingData.email);
      if (pendingData.acceptedTerms) setAcceptedTerms(pendingData.acceptedTerms);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setSession(currentSession);
        const { data: profile } = await supabase
          .from('profiles')
          // ดึงเฉพาะข้อมูลที่ใช้แสดงจริง ๆ เพื่อลดงานโหลดหน้า (ลดอาการกระตุก)
          .select('username, avatar_url')
          .eq('id', currentSession.user.id)
          .single();

        if (profile) {
          setUsername(profile.username || '');
          setAvatarUrl(profile.avatar_url || '');
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  // ฟังก์ชันช่วยบันทึกข้อมูลลง localStorage ทันทีที่มีการเปลี่ยนแปลง
  const updatePendingData = (updates: any) => {
    const currentData = safeParseJSON<Record<string, any>>('pending_registration', {});
    localStorage.setItem('pending_registration', JSON.stringify({
      ...currentData,
      ...updates
    }));
  };

  // ส่ง OTP ไปอีเมล (ສ້າງບັນຊີໃໝ່ - ไม่ใช้รหัสผ่าน)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerLoading) return;

    const missing: string[] = [];
    if (!email.trim()) missing.push('ກະລຸນາໃສ່ອີເມລ');

    if (missing.length > 0) {
      setValidationMessages(missing);
      setShowValidationPopup(true);
      return;
    }

    setRegisterLoading(true);
    setOtpError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        setOtpError(error.message || 'ບໍ່ສາມາດສົ່ງ OTP ໄດ້');
        setRegisterLoading(false);
        return;
      }
      updatePendingData({ email: email.trim() });
      setOtpSent(true);
    } catch (err) {
      setOtpError('ບໍ່ສາມາດສົ່ງ OTP ໄດ້');
      setRegisterLoading(false);
      return;
    }
    setRegisterLoading(false);
  };

  // หลังกรอก OTP: ถ้าเป็นผู้ใช้ใหม่ → ไปหน้าใส่ชื่อ+รูป, ถ้าเคยมีบัญชี → ไป home
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerLoading) return;
    if (!otpValue.trim()) {
      setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ');
      return;
    }

    setRegisterLoading(true);
    setOtpError('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpValue.trim(),
        type: 'email',
      });
      if (error) {
        setOtpError('OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ');
        setOtpValue('');
        setRegisterLoading(false);
        return;
      }
      const user = data?.user;
      if (!user) {
        setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
        setOtpValue('');
        setRegisterLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      const hasCompleteProfile = profile?.username && profile.username.trim() !== '' && profile.username !== 'Guest User';
      if (hasCompleteProfile) {
        const storedPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
        const deviceToken = localStorage.getItem('device_guest_token');
        const guestTokens = Array.from(new Set([
          ...storedPosts.map((p: any) => p.token),
          deviceToken
        ].filter(t => t !== null)));
        if (guestTokens.length > 0) {
          try {
            for (const token of guestTokens) {
              await supabase.from('cars').update({ user_id: user.id }).eq('user_id', token);
              await supabase.from('liked_posts').update({ user_id: user.id }).eq('user_id', token);
              await supabase.from('saved_posts').update({ user_id: user.id }).eq('user_id', token);
              await supabase.from('profiles').update({ id: user.id }).eq('id', token);
            }
            localStorage.removeItem('my_guest_posts');
            localStorage.removeItem('device_guest_token');
          } catch (_) {}
        }
        localStorage.removeItem('pending_registration');
        router.push('/');
      } else {
        updatePendingData({ email: email.trim(), acceptedTerms });
        router.push('/register');
      }
    } catch (_) {
      setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
      setOtpValue('');
    }
    setRegisterLoading(false);
  };

  if (loading)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: LAO_FONT }}>
        <PageSpinner />
      </div>
    );

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
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button
          onClick={() => {
            if (!session) {
              localStorage.removeItem('pending_registration');
              router.push('/');
            } else {
              // ผู้ใช้ที่ลงทะเบียนแล้ว: เปลี่ยนหน้าทันทีเหมือน viewing mode (ไม่ต้อง slide ออก)
              router.push('/');
            }
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        
        {!session ? (
          /* กรณีที่ยังไม่ได้ Login: แสดงหน้าลงทะเบียนใหม่ตามภาพสเก็ตซ์ */
          <div style={{ textAlign: 'center', paddingTop: '10px' }}>
            {/* Logo Website */}
            <div style={{ width: '100px', height: '100px', margin: '0 auto 30px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #eee' }}>
              <img 
                src="https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/avatars/9a8595cc-bfa6-407d-94d4-67e2e82523e5/WhatsApp%20Image%202026-01-09%20at%2016.10.33%20(1).jpeg" 
                alt="Logo" 
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="email" 
                  placeholder="ອີເມລ" 
                  value={email}
                  maxLength={50}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 50);
                    setEmail(val);
                    updatePendingData({ email: val });
                  }}
                  style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '16px', outline: 'none', color: '#111111' }}
                />
                {otpError && (
                  <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>
                )}
                <button 
                  type="submit" 
                  disabled={registerLoading}
                  style={{ 
                    width: '100%', 
                    padding: '15px', 
                    background: '#1877f2', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: registerLoading ? 'not-allowed' : 'pointer', 
                    marginTop: '5px' 
                  }}
                >
                  {registerLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <ButtonSpinner />
                    </span>
                  ) : 'ສົ່ງ OTP'}
                </button>
                <p style={{ fontSize: '13px', color: '#65676b', textAlign: 'center', lineHeight: 1.5, marginTop: '12px', padding: '0 8px' }}>
                  ໂດຍການສືບຕໍ່ນຳໃຊ້ບັນຊີທ່ານຕົກລົງເຫັນດີຕໍ່ ຂໍ້ກຳນົດການບໍລິການ ຂອງພວກເຮົາ ແລະ ຮັບຊາບວ່າທ່ານໄດ້ອ່ານ ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ ຂອງພວກເຮົາແລ້ວ.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: '8px' }}>
                  ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {email}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { otpInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpValue[i] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(-1);
                        const next = (otpValue.slice(0, i) + v + otpValue.slice(i + 1)).slice(0, 6);
                        setOtpValue(next);
                        if (v && i < 5) otpInputRefs.current[i + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpValue[i] && i > 0) {
                          setOtpValue((prev) => prev.slice(0, i - 1) + prev.slice(i));
                          otpInputRefs.current[i - 1]?.focus();
                        } else if (e.key === 'Backspace' && otpValue[i]) {
                          setOtpValue((prev) => prev.slice(0, i) + prev.slice(i + 1));
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pasted.length > 0) {
                          const next = (otpValue.slice(0, i) + pasted).slice(0, 6);
                          setOtpValue(next);
                          const focusIdx = Math.min(i + pasted.length, 5);
                          otpInputRefs.current[focusIdx]?.focus();
                        }
                      }}
                      style={{
                        width: '44px',
                        height: '52px',
                        padding: 0,
                        borderRadius: '12px',
                        border: '1px solid #ddd',
                        background: '#f9f9f9',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        outline: 'none',
                        color: '#111111',
                        textAlign: 'center',
                      }}
                    />
                  ))}
                </div>
                {otpError && (
                  <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>
                )}
                <button 
                  type="submit" 
                  disabled={registerLoading}
                  style={{ 
                    width: '100%', 
                    padding: '15px', 
                    background: '#1877f2', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    cursor: registerLoading ? 'not-allowed' : 'pointer', 
                    marginTop: '5px' 
                  }}
                >
                  {registerLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <ButtonSpinner />
                    </span>
                  ) : 'ຢືນຢັນ OTP'}
                </button>
                <button 
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpValue(''); setOtpError(''); }}
                  style={{ background: 'none', border: 'none', color: '#1877f2', fontSize: '14px', cursor: 'pointer', marginTop: '4px' }}
                >
                  ສົ່ງ OTP ໃໝ່
                </button>
              </form>
            )}

            {showValidationPopup && (
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
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '20px',
                    maxWidth: '320px',
                    width: '100%',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center', color: '#111111' }}>
                    ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບຖ້ວນ
                  </h3>
                  <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '15px', color: '#1c1e21', lineHeight: 1.6 }}>
                    {validationMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setShowValidationPopup(false)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
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
          </div>
        ) : (
          /* กรณีที่ Login แล้ว: แสดงหน้า Profile เดิม (ห้ามแก้ไขส่วนนี้) */
          <>
            <Link href="/profile/edit-profile" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#e0e0e0', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '75px', height: '75px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5' }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
                      <GuestAvatarIcon size={40} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</div>
                </div>
              </div>
            </Link>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/liked" style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0', borderRadius: '12px', cursor: 'pointer' }}>
                  <svg 
                    width="28" 
                    height="28" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#000000" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>
                  </svg>
                </div>
              </Link>
              <Link href="/saved" style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0', borderRadius: '12px', cursor: 'pointer' }}>
                  <svg 
                    width="28" 
                    height="28" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#000000" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path>
                  </svg>
                </div>
              </Link>
            </div>

            <button onClick={() => router.push('/profile/settings')} style={{ marginTop: '50px', width: '100%', padding: '14px', color: '#1c1e21', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              ການຕັ້ງຄ່າ
            </button>
          </>
        )}
      </div>
    </main>
  );
}
