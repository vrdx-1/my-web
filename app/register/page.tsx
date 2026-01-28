'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { safeParseJSON } from '@/utils/storageUtils'
import { LAO_FONT } from '@/utils/constants'

export default function Register() {
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  // ตรวจสอบความพร้อมของข้อมูล (ต้องมีทั้งชื่อและรูป)
  const isFormValid = username.trim() !== '' && avatarUrl !== '';

  useEffect(() => {
    const checkRegistrationData = async () => {
      // ตรวจสอบว่ามีข้อมูลอีเมล/รหัสผ่านที่ฝากมาจากหน้า profile หรือไม่
      const pendingData = localStorage.getItem('pending_registration');
      if (!pendingData) {
        router.push('/profile');
        return;
      }

      // ดึงข้อมูลชื่อและรูปภาพที่เคยกรอกค้างไว้ (ถ้ามี)
      const parsed = JSON.parse(pendingData);
      if (parsed.username) setUsername(parsed.username);
      if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
      
      // ตรวจสอบ Session เดิม (ถ้ามีอยู่แล้วให้เซ็ต userId)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
    }
    checkRegistrationData();
  }, [router])

  // ฟังก์ชันช่วยบันทึกข้อมูลชื่อและรูปภาพลง localStorage ทันที
  const updatePendingData = (updates: any) => {
    const currentData = safeParseJSON<Record<string, any>>('pending_registration', {});
    localStorage.setItem('pending_registration', JSON.stringify({
      ...currentData,
      ...updates
    }));
  };

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
    
    // Validation เพิ่มเติมเพื่อความปลอดภัย
    if (!username.trim()) return
    if (!avatarUrl) return
    
    setLoading(true)

    try {
      // 1. ดึงข้อมูล Email/Password จาก localStorage
      const pendingData = safeParseJSON<{ email?: string; password?: string; avatarUrl?: string }>('pending_registration', {});
      if (!pendingData.email || !pendingData.password) {
        throw new Error('ບໍ່ພົບຂໍ້ມູນການລົງທະບຽນ');
      }

      // ตรวจสอบความยาวรหัสผ่าน (ต้องมีอย่างน้อย 6 ตัวอักษร)
      if (pendingData.password.length < 6) {
        throw new Error('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ');
      }

      // 2. ทำการสร้างบัญชีจริง (Sign Up) ที่นี่
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: pendingData.email,
        password: pendingData.password,
      });

      if (authError) throw authError;

      const newUser = authData.user;
      if (newUser) {
        // Extract avatar path from URL for cleanup if needed
        const avatarPath = avatarUrl ? avatarUrl.split('/').slice(-2).join('/') : null;
        
        // 3. บันทึกลงตาราง profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: newUser.id,
            username: username,
            avatar_url: avatarUrl,
            updated_at: new Date(),
          });

        if (profileError) {
          // ถ้า profile upsert ล้มเหลว ให้ cleanup avatar file (ถ้ามี)
          if (avatarPath) {
            await supabase.storage.from('car-images').remove([avatarPath]).catch(() => {});
          }
          throw profileError;
        }

        // 4. Logic การโอนย้ายข้อมูลจาก Guest
        const storedPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
        const deviceToken = localStorage.getItem('device_guest_token');
        const guestTokens = Array.from(new Set([
          ...storedPosts.map((p: any) => p.token),
          deviceToken
        ].filter(t => t !== null)));

        if (guestTokens.length > 0) {
          for (const token of guestTokens) {
            await supabase.from('cars').update({ user_id: newUser.id }).eq('user_id', token);
            await supabase.from('liked_posts').update({ user_id: newUser.id }).eq('user_id', token);
            await supabase.from('saved_posts').update({ user_id: newUser.id }).eq('user_id', token);
            await supabase.from('profiles').update({ id: newUser.id }).eq('id', token);
          }
          localStorage.removeItem('my_guest_posts');
          localStorage.removeItem('device_guest_token');
        }

        // 5. ล้างข้อมูลชั่วคราวทั้งหมดและเสร็จสิ้น
        localStorage.removeItem('pending_registration');
        // บันทึก flag เพื่อแสดง popup ที่หน้า home
        localStorage.setItem('show_registration_success', 'true');
        router.push('/');
      }
    } catch (error: any) {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}>
      
      {/* Header - ปุ่มย้อนกลับแบบหน้า Edit Profile */}
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

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
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', color: '#6b6b6b', width: '100%' }}>
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
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
                textAlign: 'left'
              }}
              required
            />
          </div>

          {/* ปุ่มสำเร็จ - บังคับให้ Valid ข้อมูลก่อน */}
          <button 
            type="submit" 
            disabled={loading || uploading || !isFormValid}
            style={{ 
              width: '100%', 
              padding: '16px', 
              background: (loading || uploading || !isFormValid) ? '#e4e6eb' : '#1877f2', 
              color: (loading || uploading || !isFormValid) ? '#000' : '#fff', 
              border: 'none', 
              borderRadius: '30px', 
              fontSize: '20px', 
              fontWeight: 'bold', 
              cursor: (loading || uploading || !isFormValid) ? 'not-allowed' : 'pointer',
              transition: '0.3s'
            }}
          >
            {(loading || uploading) ? (
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
            ) : 'ສຳເລັດ'}
          </button>

        </form>
      </div>
    </div>
  )
}
