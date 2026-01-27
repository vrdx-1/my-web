'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeParseJSON } from '@/utils/storageUtils';

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);
  
  // Register State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false); // เพิ่มสถานะ Checkbox
  const [showPassword, setShowPassword] = useState(true); // Default แสดงรหัสผ่าน

  // User Data State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      // ตรวจสอบข้อมูลที่ค้างอยู่ใน localStorage ทันทีที่โหลดหน้า
      const pendingData = safeParseJSON<{ email?: string; password?: string; acceptedTerms?: boolean }>('pending_registration', {});
      if (pendingData.email) setEmail(pendingData.email);
      if (pendingData.password) setPassword(pendingData.password);
      if (pendingData.acceptedTerms) setAcceptedTerms(pendingData.acceptedTerms);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setSession(currentSession);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
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

  // ปิดการ scroll ของหน้านี้
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ฟังก์ชันช่วยบันทึกข้อมูลลง localStorage ทันทีที่มีการเปลี่ยนแปลง
  const updatePendingData = (updates: any) => {
    const currentData = safeParseJSON<Record<string, any>>('pending_registration', {});
    localStorage.setItem('pending_registration', JSON.stringify({
      ...currentData,
      ...updates
    }));
  };

  // Logic การลงทะเบียนที่ปรับปรุงใหม่ (ยังไม่เรียก signUp)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ตรวจสอบว่ายอมรับเงื่อนไขหรือยัง
    if (!acceptedTerms) {
      alert('ກະລຸນາຍອມຮັບຂໍ້ກຳນົດແລະນະໂຍບາຍກ່ອນລົງທະບຽນ');
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน (ต้องมีอย่างน้อย 6 ตัวอักษร)
    if (password.length < 6) {
      alert('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ');
      return;
    }

    setRegisterLoading(true);

    try {
      // ยืนยันการบันทึกข้อมูลก่อนไปหน้าถัดไป
      updatePendingData({ email, password, acceptedTerms });
      router.push('/register');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลชั่วคราว');
      setRegisterLoading(false);
    }
  };

  // เงื่อนไขว่าพร้อมให้กด "ລົງທະບຽນ" หรือไม่ (ต้องกรอกอีเมล, รหัสผ่านอย่างน้อย 6 ตัว และติ๊ก Checkbox)
  const canRegister = email.trim() !== '' && password.trim() !== '' && password.length >= 6 && acceptedTerms;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
    </div>
  );

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button 
          onClick={() => router.push('/')} 
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
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input 
                type="email" 
                placeholder="ອີເມລ" 
                value={email}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  updatePendingData({ email: val });
                }}
                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '16px', outline: 'none' }}
                required
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="ລະຫັດຜ່ານ" 
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassword(val);
                      updatePendingData({ password: val });
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '15px 45px 15px 15px', 
                      borderRadius: '12px', 
                      border: password.length > 0 && password.length < 6 ? '1px solid #e0245e' : '1px solid #ddd', 
                      background: '#f9f9f9', 
                      fontSize: '16px', 
                      outline: 'none' 
                    }}
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
                {password.length > 0 && password.length < 6 && (
                  <div style={{ fontSize: '13px', color: '#e0245e', textAlign: 'left' }}>
                    ລະຫັດຜ່ານຕ້ອງມີຂັ້ນຕ່ຳ 6 ຕົວ
                  </div>
                )}
              </div>

              {/* เพิ่มส่วน Checkbox ยอมรับเงื่อนไข */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', margin: '0' }}>
                <input 
                  type="checkbox" 
                  id="profile-terms"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAcceptedTerms(val);
                    updatePendingData({ acceptedTerms: val });
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '14px', color: '#000' }}>
                  ຍອມຮັບ <Link 
                    href="/terms" 
                    onClick={(e) => e.stopPropagation()} 
                    style={{ color: '#1877f2', textDecoration: 'none', fontWeight: 'bold' }}
                  >
                    ຂໍ້ກຳນົດແລະນະໂຍບາຍ
                  </Link>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={registerLoading || !canRegister}
                style={{ 
                  width: '100%', 
                  padding: '15px', 
                  background: (canRegister && !registerLoading) ? '#1877f2' : '#808080', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: 'bold', 
                  fontSize: '18px', 
                  cursor: (registerLoading || !canRegister) ? 'not-allowed' : 'pointer', 
                  marginTop: '5px' 
                }}
              >
                {registerLoading ? (
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
                ) : 'ສ້າງບັນຊີໃໝ່'}
              </button>
            </form>

            <button 
              onClick={() => router.push('/login')}
              style={{ width: '100%', padding: '15px', background: '#e0e0e0', color: '#1c1e21', border: '1px solid #ddd', borderRadius: '12px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', marginTop: '80px' }}
            >
              ເຂົ້າສູ່ລະບົບ
            </button>
          </div>
        ) : (
          /* กรณีที่ Login แล้ว: แสดงหน้า Profile เดิม (ห้ามแก้ไขส่วนนี้) */
          <>
            <Link href="/profile/edit-profile" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#e0e0e0', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '75px', height: '75px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', color: '#8a8a8a' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</div>
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
                    fill="#e0245e" 
                    stroke="#e0245e" 
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
                    fill="#FFD700" 
                    stroke="#FFD700" 
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
