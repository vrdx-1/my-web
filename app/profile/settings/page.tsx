'use client'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    const confirmLogout = confirm("ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການອອກຈາກລະບົບ?")
    if (!confirmLogout) return

    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      alert("ເກີດຂໍ້ຜິດພາດໃນການອອກຈາກລະບົບ")
      setLoading(false)
    }
  }

  return (
    <main style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      background: '#e8eef2', 
      height: '100vh', 
      overflow: 'hidden',
      fontFamily: 'sans-serif',
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
        background: '#e8eef2', 
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
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1c1e21' }}>ການຕັ້ງຄ່າ</h1>
      </div>

      {/* ส่วนเนื้อหาหลัก */}
      <div style={{ padding: '20px', flex: 1, overflow: 'hidden' }}>
        
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          
          {/* เมนูป່ຽນລະຫັດຜ່ານ - ใช้แบบเดิมไม่ต้องแก้ */}
          <div 
            onClick={() => router.push('/profile/settings/change-password')}
            style={{ 
              padding: '18px 15px', 
              borderBottom: '1px solid #f0f0f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              height: '80px',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '19px', color: '#1c1e21', fontWeight: '500' }}>ປ່ຽນລະຫັດຜ່ານ</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          {/* แก้ไขส่วน: ຕິດຕໍ່ທີມງານ Jutpai (กดได้ทั้งแถว) */}
          <a 
            href="https://wa.me/8562098859693" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              padding: '18px 15px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
              height: '80px',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '19px', color: '#1c1e21', fontWeight: '500' }}>
              ຕິດຕໍ່ທີມງານ Jutpai 02098859693
            </span>
            
            {/* ไอคอน WhatsApp สีเขียว */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M12.01 2C6.48 2 1.99 6.49 1.99 12.02c0 1.83.48 3.54 1.32 5.03L2 22l5.08-1.33c1.44.79 3.1 1.24 4.86 1.24 5.53 0 10.02-4.49 10.02-10.02 0-5.53-4.49-10.01-10.02-10.01z" fill="#25D366"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M12.01 3.51c-4.7 0-8.51 3.82-8.51 8.51 0 1.63.46 3.16 1.25 4.45L4.1 19.9l3.52-.92c1.24.68 2.66 1.07 4.18 1.07 4.7 0 8.51-3.82 8.51-8.51 0-4.69-3.82-8.51-8.51-8.51zm4.61 11.19c-.25-.13-1.5-.74-1.73-.82-.23-.08-.4-.13-.56.13-.17.25-.65.82-.8 1-.15.17-.3.18-.55.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.5-.4-.43-.56-.44l-.48-.01c-.17 0-.43.06-.66.3-.23.23-.88.86-.88 2.09 0 1.23.9 2.43 1.02 2.6.13.17 1.76 2.69 4.27 3.77.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.5-.61 1.71-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.17-.48-.3z" fill="white"/>
              </svg>
            </div>
          </a>
        </div>
      </div>

      {/* ปุ่มออกจากระบบ - ย้ายมาไว้ล่างสุดของหน้าจอ */}
      <div style={{ padding: '20px', paddingBottom: '40px', marginTop: 'auto' }}>
        <button 
          onClick={handleLogout} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '16px', 
            background: '#fff', 
            color: '#666', 
            border: 'none', 
            borderRadius: '15px', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(255, 59, 48, 0.05)'
          }}
        >
          {loading ? (
            'ກຳລັງປະມວນຜົນ...'
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              ອອກຈາກລະບົບ
            </>
          )}
        </button>
      </div>

    </main>
  )
}