'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);
  
  // Register State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false); // เพิ่มสถานะ Checkbox

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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.loading-spinner-circle { display: inline-block; width: 40px; height: 40px; position: relative; }
.loading-spinner-circle div { position: absolute; width: 8px; height: 8px; border-radius: 50%; top: 0; left: 50%; margin-left: -4px; transform-origin: 4px 20px; background: #f0f0f0; animation: fadeColor 1s linear infinite; }
.loading-spinner-circle div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.loading-spinner-circle div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.loading-spinner-circle div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.loading-spinner-circle div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.loading-spinner-circle div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.loading-spinner-circle div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.loading-spinner-circle div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.loading-spinner-circle div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
`}</style>
      <div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
    </div>
  );

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button 
          onClick={() => router.push('/')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '0' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
              <input 
                type="password" 
                placeholder="ລະຫັດຜ່ານ" 
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  updatePendingData({ password: val });
                }}
                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '16px', outline: 'none' }}
                required
              />

              {/* เพิ่มส่วน Checkbox ยอมรับเงื่อนไข */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '5px 0 10px 0' }}>
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
                disabled={registerLoading || !acceptedTerms}
                style={{ 
                  width: '100%', 
                  padding: '15px', 
                  background: (registerLoading || !acceptedTerms) ? '#e4e6eb' : '#1c1e21', 
                  color: (registerLoading || !acceptedTerms) ? '#999' : '#fff', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  cursor: (registerLoading || !acceptedTerms) ? 'not-allowed' : 'pointer', 
                  marginTop: '5px' 
                }}
              >
                {registerLoading ? 'ກຳລັງປະມວນຜົນ...' : 'ລົງທະບຽນ'}
              </button>
            </form>

            <button 
              onClick={() => router.push('/login')}
              style={{ width: '100%', padding: '15px', background: 'none', color: '#1c1e21', border: '1px solid #ddd', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '60px' }}
            >
              ເຂົ້າສູ່ລະບົບ
            </button>
          </div>
        ) : (
          /* กรณีที่ Login แล้ว: แสดงหน้า Profile เดิม (ห้ามแก้ไขส่วนนี้) */
          <>
            <Link href="/profile/edit-profile" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#fff', border: '1px solid #eee', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '75px', height: '75px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5', border: '2px solid #1877f2' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</div>
                </div>
              </div>
            </Link>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/saved" style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #ddd', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </div>
              </Link>
              <Link href="/liked" style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #ddd', cursor: 'pointer' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#e0245e" stroke="#e0245e" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </div>
              </Link>
            </div>

            <button onClick={() => router.push('/profile/settings')} style={{ marginTop: '50px', width: '100%', padding: '14px', color: '#1c1e21', background: '#fff', border: '1px solid #ddd', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2 2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              ການຕັ້ງຄ່າ
            </button>
          </>
        )}
      </div>
    </main>
  );
}
