'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TermsAndPolicies() {
  const router = useRouter();
  const [policy, setPolicy] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const { data, error } = await supabase
          .from('app_policies')
          .select('title, content')
          .eq('slug', 'terms') // ดึงข้อมูลเฉพาะตัวที่เราใส่ slug ว่า terms
          .single();

        if (error) throw error;
        if (data) setPolicy(data);
      } catch (error) {
        console.error('Error fetching policy:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, []);

  return (
    <main style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      background: '#fff', 
      minHeight: '100vh', 
      fontFamily: 'sans-serif' 
    }}>
      
      {/* Header - ปุ่มย้อนกลับ */}
      <div style={{ 
        padding: '15px', 
        display: 'flex', 
        alignItems: 'center', 
        position: 'sticky', 
        top: 0, 
        background: '#fff', 
        borderBottom: '1px solid #eee',
        zIndex: 100 
      }}>
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#1c1e21' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span style={{ marginLeft: '10px', fontWeight: 'bold', fontSize: '18px' }}>ກັບຄືນ</span>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#65676b' }}>ກຳລັງໂຫລດ...</div>
        ) : policy ? (
          <>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#1c1e21' }}>
              {policy.title}
            </h1>
            
            {/* ส่วนแสดงเนื้อหา: ใช้ whiteSpace: 'pre-wrap' เพื่อให้เว้นบรรทัดตามฐานข้อมูล */}
            <div style={{ 
              fontSize: '15px', 
              lineHeight: '1.6', 
              color: '#4b4b4b', 
              whiteSpace: 'pre-wrap', // สำคัญมาก เพื่อให้แสดงผลการเว้นบรรทัดตามที่ Insert ไว้
              textAlign: 'left'
            }}>
              {policy.content}
            </div>

            <div style={{ height: '50px' }}></div> {/* พื้นที่ว่างด้านล่าง */}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#65676b' }}>
            ບໍ່ພົບຂໍ້ມູນຂໍ້ກຳນົດ ແລະ ນະໂຍບາຍ
          </div>
        )}
      </div>
    </main>
  );
}