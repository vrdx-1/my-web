'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { safeParseJSON } from '@/utils/storageUtils'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon'

export default function Register() {
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showValidationPopup, setShowValidationPopup] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const router = useRouter()

  // ตรวจสอบความพร้อมของข้อมูล (ต้องมีทั้งชื่อและรูป)
  const isFormValid = username.trim() !== '' && avatarUrl !== '';

  useEffect(() => {
    const checkRegistrationData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
      const pendingData = localStorage.getItem('pending_registration');
      if (!pendingData && !session) {
        router.push('/profile');
        return;
      }
      if (pendingData) {
        const parsed = JSON.parse(pendingData);
        if (parsed.username) setUsername(parsed.username);
        if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
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
        router.push('/profile');
        return;
      }
      const newUser = session.user;

      const avatarPath = avatarUrl ? avatarUrl.split('/').slice(-2).join('/') : null;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUser.id,
          username: username,
          avatar_url: avatarUrl,
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

  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: LAO_FONT, position: 'relative' }}>
      
      {/* Header - หน้าตั้งชื่อและรูปโปรไฟล์ (ไม่มีปุ่มย้อนกลับ) */}
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
                  {validationMessage}
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

        </form>
      </div>
    </div>
  )
}
