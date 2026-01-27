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
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
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