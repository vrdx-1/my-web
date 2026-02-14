'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { safeParseJSON } from '@/utils/storageUtils'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon'
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils'
import { REGISTER_PATH, LOGIN_PATH, PROFILE_PATH } from '@/utils/authRoutes'
import { useOtpResendCountdown } from '@/hooks/useOtpResendCountdown'
import { OtpInputs, AuthOAuthButtons, AuthValidationPopup } from '@/components/auth'
import { sendOtpToEmail, verifyOtpEmail } from '@/utils/authOtp'

export default function Register() {
  const router = useRouter()

  // Step 1: ยังไม่มี session — อีเมล / OTP / OAuth
  const [email, setEmail] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpError, setOtpError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [showEmailValidationPopup, setShowEmailValidationPopup] = useState(false)
  const [resendTrigger, setResendTrigger] = useState(0)
  const resendSeconds = useOtpResendCountdown(otpSent, resendTrigger)

  // Step 2: มี session — ชื่อ + รูป
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [showValidationPopup, setShowValidationPopup] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    const checkRegistrationData = async () => {
      const pendingData = safeParseJSON<{ email?: string; acceptedTerms?: boolean; username?: string; avatarUrl?: string }>('pending_registration', {})
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (currentSession) {
        setSession(currentSession)
        setUserId(currentSession.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', currentSession.user.id)
          .single()
        const hasExistingAccount =
          profile &&
          profile.username &&
          String(profile.username).trim() !== '' &&
          profile.username !== 'Guest User'
        if (hasExistingAccount) {
          localStorage.removeItem('pending_registration')
          router.push('/')
          return
        }
        if (profile?.avatar_url && isProviderDefaultAvatar(profile.avatar_url)) {
          await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentSession.user.id)
        }
        if (pendingData.username) setUsername(pendingData.username)
        if (pendingData.avatarUrl) {
          const av = pendingData.avatarUrl
          setAvatarUrl(isProviderDefaultAvatar(av) ? '' : av)
        }
      } else {
        if (pendingData.email) setEmail(pendingData.email)
        if (pendingData.acceptedTerms) setAcceptedTerms(pendingData.acceptedTerms)
      }
    }
    checkRegistrationData()
  }, [router])

  const updatePendingData = (updates: any) => {
    const currentData = safeParseJSON<Record<string, any>>('pending_registration', {});
    localStorage.setItem('pending_registration', JSON.stringify({ ...currentData, ...updates }));
  }

  const handleOAuthLogin = async (provider: 'facebook' | 'google') => {
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${PROFILE_PATH}` : PROFILE_PATH
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
    } catch (err) {
      console.error('OAuth login error', err)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (registerLoading) return
    if (!email.trim()) {
      setShowEmailValidationPopup(true)
      return
    }
    setRegisterLoading(true)
    setOtpError('')
    const { error } = await sendOtpToEmail(email, true)
    if (error) setOtpError(error)
    else {
      updatePendingData({ email: email.trim() })
      setOtpSent(true)
    }
    setRegisterLoading(false)
  }

  const verifyOtpCode = async (code: string) => {
    if (registerLoading || !code.trim()) {
      if (!code.trim()) setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ')
      return
    }
    setRegisterLoading(true)
    setOtpError('')
    try {
      const { data, error } = await verifyOtpEmail(email, code)
      if (error) {
        setOtpError(resendSeconds > 0 ? 'OTP ບໍ່ຖືກຕ້ອງ' : 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ')
        setOtpValue('')
        setRegisterLoading(false)
        return
      }
      const user = data?.user
      if (!user) {
        setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້')
        setOtpValue('')
        setRegisterLoading(false)
        return
      }
      const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : NaN
      const isNewEmailUser = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 60_000

      let { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      const rawAvatar = profile?.avatar_url || ''
      if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
        const { data: updated } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle()
        if (updated) profile = updated
      }

      const displayAvatar = getDisplayAvatarUrl(profile?.avatar_url)
      const hasCompleteProfile =
        !!profile &&
        !!profile.username &&
        profile.username.trim() !== '' &&
        profile.username !== 'Guest User' &&
        displayAvatar !== ''

      if (isNewEmailUser) {
        const meta = user.user_metadata || {}
        const displayName = meta.full_name || meta.name || meta.display_name || ''
        const emailStr = user.email ?? email.trim()
        const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '')
        const defaultName = (displayName || emailFallback || 'Guest User').trim()
        try {
          await supabase.from('profiles').upsert(
            { id: user.id, username: defaultName, avatar_url: null },
            { onConflict: 'id' }
          )
        } catch {}
        localStorage.removeItem('pending_registration')
        router.push('/')
      } else if (hasCompleteProfile) {
        localStorage.removeItem('pending_registration')
        router.push('/')
      } else {
        updatePendingData({ email: email.trim(), acceptedTerms })
        router.push(REGISTER_PATH)
      }
    } catch {
      setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້')
      setOtpValue('')
    }
    setRegisterLoading(false)
  }

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    verifyOtpCode(otpValue.trim())
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
      
      // หากยังไม่ได้กดสมัครสมาชิก ให้ใช้ชื่อไฟล์ชั่วคราวก่อน
      const currentId = userId || 'temp-' + Date.now();
      const filePath = `avatars/${currentId}-${Date.now()}`
      
      const { error: uploadError } = await supabase.storage
        .from('car-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('car-images')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      // บันทึก URL รูปภาพลง localStorage ทันที
      updatePendingData({ avatarUrl: publicUrl });
    } catch (error: any) {
    } finally {
      setUploading(false)
    }
  }

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    // ถ้ายังไม่กรอกชื่อ หรือยังไม่เลือกรูปโปรไฟล์ → แสดงป๊อบอัพแจ้งเตือน แทนการส่งฟอร์ม
    const missingName = !username.trim()
    const missingAvatar = !avatarUrl

    if (missingName || missingAvatar) {
      if (missingAvatar && !missingName) {
        // กรณีขาดเฉพาะรูปโปรไฟล์
        setValidationMessage('ກະລຸນາໃສ່ຮູບໂປຣຟາຍ')
      } else if (missingName && !missingAvatar) {
        // กรณีขาดเฉพาะชื่อ
        setValidationMessage('ກະລຸນາໃສ່ຊື່')
      } else {
        // กรณีขาดทั้งชื่อและรูปโปรไฟล์
        setValidationMessage('ກະລຸນາໃສ່ຊື່ ແລະ ຮູບໂປຣຟາຍ')
      }
      setShowValidationPopup(true)
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        router.push(REGISTER_PATH);
        return;
      }
      const newUser = session.user;

      // บัญชีที่มีอยู่แล้ว Login ผ่านหน้าลงทะเบียนได้ → ส่งเข้า Home
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', newUser.id)
        .single();
      const hasExistingAccount =
        existingProfile &&
        existingProfile.username &&
        String(existingProfile.username).trim() !== '' &&
        existingProfile.username !== 'Guest User';
      if (hasExistingAccount) {
        setLoading(false);
        localStorage.removeItem('pending_registration');
        router.push('/');
        return;
      }

      const avatarPath = avatarUrl ? avatarUrl.split('/').slice(-2).join('/') : null;

      // ตรวจสอบรูป default (100×100) และลบออกหลังลงทะเบียนเสร็จ
      // ถ้าเป็นรูป default ให้ตั้งเป็น null เพื่อใช้รูป default ของระบบแทน
      const finalAvatarUrl = avatarUrl && isProviderDefaultAvatar(avatarUrl) ? null : avatarUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUser.id,
          username: username,
          avatar_url: finalAvatarUrl,
          updated_at: new Date(),
        });

      if (profileError) {
        if (avatarPath) {
          await supabase.storage.from('car-images').remove([avatarPath]).catch(() => {});
        }
        throw profileError;
      }

      localStorage.removeItem('pending_registration');
      localStorage.setItem('show_registration_success', 'true');
      router.push('/');
    } catch (error: any) {
      setLoading(false);
    }
  }

  // Step 1: ยังไม่มี session — แสดงฟอร์มอีเมล / OTP / OAuth
  if (!session) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT }}>
        <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
          <button
            type="button"
            onClick={() => { localStorage.removeItem('pending_registration'); router.push('/'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#1c1e21' }}>ສ້າງບັນຊີໃໝ່</h1>
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)' }}>
          {!otpSent ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input
                type="email"
                placeholder="ອີເມລ"
                value={email}
                maxLength={50}
                onChange={(e) => { const v = e.target.value.slice(0, 50); setEmail(v); updatePendingData({ email: v }); }}
                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '16px', outline: 'none', color: '#111111' }}
              />
              {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
              <button
                type="submit"
                disabled={registerLoading}
                style={{ width: '100%', padding: '15px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '18px', cursor: registerLoading ? 'not-allowed' : 'pointer', marginTop: '5px' }}
              >
                {registerLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ButtonSpinner /></span> : 'ສົ່ງ OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: '8px' }}>ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {email}</p>
              <OtpInputs
                value={otpValue}
                onChange={setOtpValue}
                onComplete={verifyOtpCode}
                disabled={registerLoading}
              />
              {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
              <button
                type="button"
                onClick={async () => {
                  if (resendSeconds > 0 || registerLoading) return
                  setRegisterLoading(true)
                  setOtpError('')
                  const { error } = await sendOtpToEmail(email, true)
                  if (error) setOtpError(error)
                  else { setOtpValue(''); setResendTrigger((t) => t + 1) }
                  setRegisterLoading(false)
                }}
                style={{ background: 'none', border: 'none', color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2', fontSize: '14px', cursor: resendSeconds > 0 ? 'default' : 'pointer', marginTop: '4px', alignSelf: 'center' }}
              >
                ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
              </button>
            </form>
          )}
          {!otpSent && (
            <>
              <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                  <span style={{ margin: '0 10px', fontSize: '13px', color: '#65676b' }}>ຫຼື</span>
                  <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                </div>
                <AuthOAuthButtons
                  redirectTo={typeof window !== 'undefined' ? `${window.location.origin}${PROFILE_PATH}` : PROFILE_PATH}
                  onOAuth={handleOAuthLogin}
                  facebookLabel="ລົງທະບຽນດ້ວຍ Facebook"
                  googleLabel="ລົງທະບຽນດ້ວຍ Google"
                />
              </div>
              <div style={{ marginTop: '40px', marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', color: '#65676b', textAlign: 'center', lineHeight: 1.5, margin: '0 0 20px', padding: '0 8px' }}>
                  ການສ້າງບັນຊີໝາຍຄວາມວ່າທ່ານຍອມຮັບ{' '}
                  <Link href="/terms" onClick={(e) => e.stopPropagation()} style={{ color: '#1877f2', textDecoration: 'none', fontWeight: 'bold' }}>ຂໍ້ກຳນົດແລະນະໂຍບາຍ</Link>
                </p>
                <p style={{ fontSize: '18px', color: '#1c1e21', textAlign: 'center', marginTop: '4px', fontWeight: '700' }}>
                  ທ່ານມີບັນຊີແລ້ວບໍ?{' '}
                  <button type="button" onClick={() => router.push(LOGIN_PATH)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: '#1877f2', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}>ເຂົ້າສູ່ລະບົບ</button>
                </p>
              </div>
            </>
          )}
          <AuthValidationPopup
            show={showEmailValidationPopup}
            message="ກະລຸນາໃສ່ອີເມລ"
            onClose={() => setShowEmailValidationPopup(false)}
          />
        </div>
      </div>
    )
  }

  // Step 2: มี session — ตั้งชื่อ + รูป
  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}>
      <div style={{ padding: '15px 15px 5px 15px', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }} />
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <form onSubmit={handleCompleteProfile} style={{ textAlign: 'center' }}>
          
          {/* Profile Image Section */}
          <div style={{ marginBottom: '40px', position: 'relative', display: 'inline-block' }}>
            <div style={{ 
              width: '130px', 
              height: '130px', 
              borderRadius: '50%', 
              background: '#f0f2f5', 
              overflow: 'hidden', 
              border: 'none', 
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', width: '100%' }}>
                  <GuestAvatarIcon size={60} />
                </div>
              )}
            </div>
            
            <label style={{ 
              position: 'absolute', 
              bottom: '5px', 
              right: '5px', 
              background: '#fff', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #eee'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <input type="file" accept="image/*" onChange={handleUploadAvatar} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>

          {/* Input ชื่อของผู้ใช้ */}
          <div style={{ marginBottom: '30px' }}>
            <input 
              type="text" 
              placeholder="ຊື່ຂອງທ່ານ" 
              value={username}
              maxLength={36}
              onChange={(e) => {
                const val = e.target.value.slice(0, 36);
                setUsername(val);
                updatePendingData({ username: val });
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pastedText = e.clipboardData.getData('text').slice(0, 36);
                const newValue = (username + pastedText).slice(0, 36);
                setUsername(newValue);
                updatePendingData({ username: newValue });
              }}
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '15px', 
                border: '1px solid #ddd', 
                background: '#fff', 
                outline: 'none', 
                fontSize: '16px',
                textAlign: 'left',
                color: '#111111'
              }}
            />
          </div>

          {/* ปุ่มสำเร็จ - บังคับให้ Valid ข้อมูลก่อน */}
          <button 
            type="submit" 
            disabled={loading || uploading}
            style={{ 
              width: '100%', 
              padding: '16px', 
              background: (loading || uploading) ? '#e4e6eb' : '#1877f2', 
              color: (loading || uploading) ? '#000' : '#fff', 
              border: 'none', 
              borderRadius: '30px', 
              fontSize: '20px', 
              fontWeight: 'bold', 
              cursor: (loading || uploading) ? 'not-allowed' : 'pointer',
              transition: '0.3s'
            }}
          >
            {(loading || uploading) ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ButtonSpinner />
              </span>
            ) : 'ສຳເລັດ'}
          </button>

          <AuthValidationPopup
            show={showValidationPopup}
            message={validationMessage}
            onClose={() => setShowValidationPopup(false)}
          />

        </form>
      </div>
    </div>
  )
}
