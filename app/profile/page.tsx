'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeParseJSON } from '@/utils/storageUtils';
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
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
  const [resendSeconds, setResendSeconds] = useState(60);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

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
        const user = currentSession.user;
        
        // ตรวจสอบว่าเป็นบัญชีใหม่จาก OAuth (Google/Facebook) หรือไม่
        const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : NaN;
        const isNewEmailUser =
          Number.isFinite(createdAtMs) &&
          Date.now() - createdAtMs < 1 * 60 * 1000; // ภายใน 1 นาทีถือว่าเป็น email ใหม่ที่เพิ่งสมัคร

        const { data: profile } = await supabase
          .from('profiles')
          // ดึงเฉพาะข้อมูลที่ใช้แสดงจริง ๆ เพื่อลดงานโหลดหน้า (ลดอาการกระตุก)
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        // ถ้าเป็นบัญชีใหม่จาก OAuth → auto-setup เหมือน email (upsert ทุกครั้ง)
        // แต่ต้อง redirect เฉพาะเมื่อเป็น OAuth callback เท่านั้น
        // ถ้าผู้ใช้กดเข้าหน้า profile เอง (มี username อยู่แล้ว) → แสดง profile ตามปกติ
        if (isNewEmailUser) {
          // ตรวจสอบว่าผู้ใช้กดเข้าหน้า profile เองหรือไม่ (มี username ที่ไม่ใช่ Guest User)
          const hasRealUsername =
            !!profile &&
            !!profile.username &&
            profile.username.trim() !== '' &&
            profile.username !== 'Guest User';

          // ตรวจสอบว่าเป็น OAuth provider หรือไม่
          const isOAuthProvider = user.app_metadata?.provider && 
            (user.app_metadata.provider === 'google' || user.app_metadata.provider === 'facebook');

          // ถ้าเป็น OAuth callback (เป็น OAuth provider และยังไม่มี username) → auto-setup และ redirect
          // ถ้าผู้ใช้กดเข้าหน้า profile เอง (มี username อยู่แล้ว) → ข้าม auto-setup
          if (isOAuthProvider && !hasRealUsername) {
            // ตรวจสอบรูป default (100×100) และลบออก
            const rawAvatar = profile?.avatar_url || '';
            if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
              await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            }

            // ตั้ง default name และ avatar_url: null ทุกครั้ง
            const meta = user.user_metadata || {};
            // ลองหา Display name จาก metadata (full_name, name, display_name)
            const displayName =
              meta.full_name ||
              meta.name ||
              meta.display_name ||
              '';

            // ถ้าไม่เจอ Display name → ใช้ชื่อจากอีเมลแต่ตัด "@gmail.com" หรือ domain อื่นๆ ออก
            const emailStr = user.email || '';
            // ตัด domain ออก (เช่น @gmail.com, @outlook.com, @yahoo.com เป็นต้น)
            const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '');

            // ใช้ Display name แทนอีเมล (ถ้ามี) ถ้าไม่มีค่อยใช้อีเมลที่ตัด domain ออก
            const defaultName = (displayName || emailFallback || 'Guest User').trim();

            try {
              await supabase
                .from('profiles')
                .upsert(
                  {
                    id: user.id,
                    username: defaultName,
                    avatar_url: null, // ตั้ง default รูป Avatar (null = รูป default ของระบบ) ทุกครั้ง
                  },
                  { onConflict: 'id' }
                );
              
              // อัพเดท state เพื่อแสดงผล
              setUsername(defaultName);
              setAvatarUrl('');
              
              // ลบ pending registration และ redirect ไปหน้า home
              localStorage.removeItem('pending_registration');
              router.push('/');
              return;
            } catch {
              // ถ้า upsert โปรไฟล์พัง ให้ข้ามไป
            }
          } else if (isOAuthProvider && hasRealUsername) {
            // เป็น OAuth provider แต่มี username อยู่แล้ว (ผู้ใช้กดเข้าหน้า profile เอง) → แสดง profile ตามปกติ
            // ไม่ต้อง redirect
          } else if (!isOAuthProvider) {
            // ไม่ใช่ OAuth provider (เป็น email registration) → auto-setup แต่ไม่ redirect (ให้แสดง profile ตามปกติ)
            // ตรวจสอบรูป default (100×100) และลบออก
            const rawAvatar = profile?.avatar_url || '';
            if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
              await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            }

            // ตั้ง default name และ avatar_url: null ทุกครั้ง
            const meta = user.user_metadata || {};
            const displayName =
              meta.full_name ||
              meta.name ||
              meta.display_name ||
              '';
            const emailStr = user.email || '';
            const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '');
            const defaultName = (displayName || emailFallback || 'Guest User').trim();

            try {
              await supabase
                .from('profiles')
                .upsert(
                  {
                    id: user.id,
                    username: defaultName,
                    avatar_url: null,
                  },
                  { onConflict: 'id' }
                );
              
              // อัพเดท state เพื่อแสดงผล
              setUsername(defaultName);
              setAvatarUrl('');
            } catch {
              // ถ้า upsert โปรไฟล์พัง ให้ข้ามไป
            }
          }
        }

        // กรณีปกติ (ไม่ใช่บัญชีใหม่) → แสดง profile ตามปกติ
        if (profile) {
          setUsername(profile.username || '');

          const rawAvatar = profile.avatar_url || '';
          // ถ้าเป็นรูป default จาก OAuth ให้ลบออกจาก DB เพื่อใช้รูป default ของระบบ
          if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
            await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentSession.user.id);
            setAvatarUrl('');
          } else {
            setAvatarUrl(getDisplayAvatarUrl(rawAvatar));
          }
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  // นับเวลาถอยหลัง 60 วิ สำหรับปุ่มສົ່ງ OTP ໃໝ່
  useEffect(() => {
    if (!otpSent) return;
    setResendSeconds(60);
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpSent]);

  // ฟังก์ชันช่วยบันทึกข้อมูลลง localStorage ทันทีที่มีการเปลี่ยนแปลง
  const updatePendingData = (updates: any) => {
    const currentData = safeParseJSON<Record<string, any>>('pending_registration', {});
    localStorage.setItem('pending_registration', JSON.stringify({
      ...currentData,
      ...updates
    }));
  };

  // Social / OAuth login (Facebook, Apple, Google)
  const handleOAuthLogin = async (provider: 'facebook' | 'apple' | 'google') => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        // กรณีลงทะเบียนด้วย Google หรือ Facebook → Callback กลับมาที่หน้า profile เพื่อตรวจสอบและ auto-setup
        ...(provider === 'google' || provider === 'facebook'
          ? { options: { redirectTo: `${window.location.origin}/profile` } }
          : {}),
      });
    } catch (err) {
      console.error('OAuth login error', err);
    }
  };

  // ส่ง OTP ไปอีเมล (ສ້າງບັນຊີໃໝ່ - ไม่ใช้รหัสผ่าน) | บัญชีที่มีอยู่แล้วก็สามารถ Login ผ่านหน้านี้ได้
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
  const verifyOtpCode = async (code: string) => {
    if (registerLoading) return;
    if (!code.trim()) {
      setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ');
      return;
    }

    setRegisterLoading(true);
    setOtpError('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) {
        setOtpError(resendSeconds > 0 ? 'OTP ບໍ່ຖືກຕ້ອງ' : 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ');
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
      // ใช้ created_at จาก auth.users เพื่อตรวจสอบว่า email นี้เพิ่งถูกสร้างครั้งแรกหรือไม่
      const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : NaN;
      const isNewEmailUser =
        Number.isFinite(createdAtMs) &&
        Date.now() - createdAtMs < 1 * 60 * 1000; // ภายใน 1 นาทีถือว่าเป็น email ใหม่ที่เพิ่งสมัคร

      let { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      // ตรวจสอบรูป default (100×100) และลบออกหลังลงทะเบียนเสร็จ
      const rawAvatar = profile?.avatar_url || '';
      if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
        // ดึง profile ใหม่หลังลบรูป default เพื่อใช้ค่า avatar_url ที่เป็น null
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (updatedProfile) {
          profile = updatedProfile;
        }
      }
      
      const displayAvatar = getDisplayAvatarUrl(profile?.avatar_url);
      const hasCompleteProfile =
        !!profile &&
        !!profile.username &&
        profile.username.trim() !== '' &&
        profile.username !== 'Guest User' &&
        displayAvatar !== '';

      // ถ้า email นี้เพิ่งถูกสร้างเป็น user ครั้งแรก (isNewEmailUser) → upsert profile ด้วย defaultName และ avatar_url: null ทุกครั้ง
      // (แม้ผู้ใช้เก่าที่มีชื่ออยู่แล้ว แต่ระบบยังถือว่าเป็น "new" ก็จะเขียนทับชื่อด้วย defaultName)
      if (isNewEmailUser) {
        // ผู้ใช้ลงทะเบียนใหม่ผ่าน OTP → ตั้ง default รูป Avatar และใช้ชื่อจาก Display name หรืออีเมล
        const meta = user.user_metadata || {};
        // ลองหา Display name จาก metadata (full_name, name, display_name)
        const displayName =
          meta.full_name ||
          meta.name ||
          meta.display_name ||
          '';

        // ถ้าไม่เจอ Display name → ใช้ชื่อจากอีเมลแต่ตัด "@gmail.com" หรือ domain อื่นๆ ออก
        const emailStr = user.email ?? email.trim();
        // ตัด domain ออก (เช่น @gmail.com, @outlook.com, @yahoo.com เป็นต้น)
        const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '');

        // ใช้ Display name แทนอีเมล (ถ้ามี) ถ้าไม่มีค่อยใช้อีเมลที่ตัด domain ออก
        const defaultName = (displayName || emailFallback || 'Guest User').trim();

        try {
          await supabase
            .from('profiles')
            .upsert(
              {
                id: user.id,
                username: defaultName,
                avatar_url: null, // ตั้ง default รูป Avatar (null = รูป default ของระบบ) ทุกครั้ง
              },
              { onConflict: 'id' }
            );
        } catch {
          // ถ้า upsert โปรไฟล์พัง ให้ข้ามไปไม่ให้มีผลกับการ login
        }

        localStorage.removeItem('pending_registration');
        router.push('/');
      } else if (hasCompleteProfile) {
        // บัญชีที่มีอยู่แล้ว Login ผ่านหน้าลงทะเบียนได้ → เข้า Home
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyOtpCode(otpValue.trim());
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
        {!session && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#1c1e21' }}>
              ສ້າງບັນຊີໃໝ່
            </h1>
          </div>
        )}
      </div>

      <div style={{ padding: '20px' }}>
        
        {!session ? (
          /* กรณีที่ยังไม่ได้ Login: แสดงหน้าสร้างบัญชีใหม่ */
          <div
            style={{
              textAlign: 'center',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 'calc(100vh - 80px)',
            }}
          >

            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="email" 
                  placeholder="ອີເມລ" 
                  value={email}
                  maxLength={50}
                  ref={emailInputRef}
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
                        const code = next.trim();
                        if (code.length === 6) {
                          void verifyOtpCode(code);
                        } else if (v && i < 5) {
                          otpInputRefs.current[i + 1]?.focus();
                        }
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
                          const code = next.trim();
                          if (code.length === 6) {
                            void verifyOtpCode(code);
                          } else {
                            const focusIdx = Math.min(i + pasted.length, 5);
                            otpInputRefs.current[focusIdx]?.focus();
                          }
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
                  type="button"
                  onClick={async () => {
                    if (resendSeconds > 0 || registerLoading) return;
                    setRegisterLoading(true);
                    setOtpError('');
                    try {
                      const { error } = await supabase.auth.signInWithOtp({
                        email: email.trim(),
                        options: { shouldCreateUser: true },
                      });
                      if (error) {
                        setOtpError(error.message || 'ບໍ່ສາມາດສົ່ງ OTP ໃໝ່ໄດ້');
                      } else {
                        setOtpValue('');
                        setResendSeconds(60);
                      }
                    } catch {
                      setOtpError('ບໍ່ສາມາດສົ່ງ OTP ໃໝ່ໄດ້');
                    }
                    setRegisterLoading(false);
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2', 
                    fontSize: '14px', 
                    cursor: resendSeconds > 0 ? 'default' : 'pointer', 
                    marginTop: '4px',
                    alignSelf: 'center'
                  }}
                >
                  ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
                </button>
              </form>
            )}

            {/* แถบตัวเลือกสร้างบัญชีด้วย Email / Facebook / Apple / Google */}
            {!otpSent && (
            <>
              <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                  <span style={{ margin: '0 10px', fontSize: '13px', color: '#65676b' }}>ຫຼື</span>
                  <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('facebook')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#f0f2f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#111111',
                    }}
                  >
                    <span style={{ width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </span>
                    <span>ລົງທະບຽນດ້ວຍ Facebook</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#f0f2f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#111111',
                    }}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        style={{ width: '16px', height: '16px' }}
                      />
                    </span>
                    <span>ລົງທະບຽນດ້ວຍ Google</span>
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '40px', marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', color: '#65676b', textAlign: 'center', lineHeight: 1.5, marginTop: '0', marginBottom: '20px', padding: '0 8px' }}>
                  ການສ້າງບັນຊີໝາຍຄວາມວ່າທ່ານຍອມຮັບ{' '}
                  <Link
                    href="/terms"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#1877f2', textDecoration: 'none', fontWeight: 'bold' }}
                  >
                    ຂໍ້ກຳນົດແລະນະໂຍບາຍ
                  </Link>
                </p>

                <p style={{ fontSize: '18px', color: '#1c1e21', textAlign: 'center', marginTop: '4px', fontWeight: '700' }}>
                  ທ່ານມີບັນຊີແລ້ວບໍ?{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      color: '#1877f2',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '700',
                    }}
                  >
                    ເຂົ້າສູ່ລະບົບ
                  </button>
                </p>
              </div>
            </>
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
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#111111' }}>
                    ກະລຸນາໃສ່ອີເມລ
                  </h3>
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
