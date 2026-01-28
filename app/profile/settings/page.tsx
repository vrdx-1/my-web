'use client'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { LAO_FONT } from '@/utils/constants'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // ปิดการ scroll ของหน้านี้
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
  }

  const handleLogoutConfirm = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      setLoading(false)
      setShowLogoutConfirm(false)
    }
  }

  const handleLogoutCancel = () => {
    if (!loading) {
      setShowLogoutConfirm(false)
    }
  }

  return (
    <main style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      background: '#fff', 
      height: '100vh', 
      overflow: 'hidden',
      fontFamily: LAO_FONT,
      display: 'flex',
      flexDirection: 'column' // กำหนดเป็น column เพื่อให้แยกส่วนบนกับส่วนล่างได้
    }}>
      
      {/* Header - คงเดิมตามที่คุณชอบ */}
      <div style={{ 
        padding: '20px 15px 10px 15px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'sticky',
        top: 0, 
        background: '#fff', 
        zIndex: 100,
        borderBottom: '1px solid #ddd'
      }}>
        <button 
          onClick={() => router.back()} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#1c1e21', 
            padding: '0',
            position: 'absolute',
            left: '15px'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ການຕັ້ງຄ່າ</h1>
      </div>

      {/* ส่วนเนื้อหาหลัก */}
      <div style={{ padding: '20px 20px 0 20px', flex: 0 }}>
        
        <div style={{ background: '#e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
          
          {/* เมนูป່ຽນລະຫັດຜ່ານ - ใช้แบบเดิมไม่ต้องแก้ */}
          <div 
            onClick={() => router.push('/profile/settings/change-password')}
            style={{ 
              padding: '12px 15px', 
              borderBottom: '1px solid #f0f0f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              height: '55px',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '16px', color: '#1c1e21', fontWeight: '500' }}>ປ່ຽນລະຫັດຜ່ານ</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          {/* แก้ไขส่วน: ຕິດຕໍ່ທີມງານ Jutpai (กดได้ทั้งแถว) */}
          <a 
            href="https://wa.me/8562098859693" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              padding: '12px 15px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
              height: '55px',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '16px', color: '#1c1e21', fontWeight: '500' }}>
              ຕິດຕໍ່ທີມງານ Jutpai 02098859693
            </span>
            <svg width="20" height="20" fill="#25D366" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* ปุ่มออกจากระบบ - ย้ายลงมาต่ำกว่าเดิม */}
      <div style={{ padding: '420px 20px 20px 20px' }}>
        <button 
          onClick={handleLogoutClick} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#e0e0e0', 
            color: '#666', 
            border: 'none', 
            borderRadius: '15px', 
            fontSize: '14px', 
            fontWeight: 'bold', 
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(255, 59, 48, 0.05)'
          }}
        >
          {loading ? (
            'ກຳລັງປະມວນຜົນ...'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              ອອກຈາກລະບົບ
            </>
          )}
        </button>
      </div>

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
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
          onClick={loading ? undefined : handleLogoutCancel}
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
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
              ທ່ານຕ້ອງການອອກຈາກລະບົບບໍ?
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleLogoutCancel}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
                ) : 'ອອກຈາກລະບົບ'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}