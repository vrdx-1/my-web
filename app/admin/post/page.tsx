'use client'
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// รายชื่อแขวงทั้งหมด 18 แขวงของลาว
const LAO_PROVINCES = [
  "ຜົ້ງສາລີ", "ຫຼວງນ້ຳທາ", "ອຸດົມໄຊ", "ບໍ່ແກ້ວ", "ຫຼວງພະບາງ", 
  "ຫົວພັນ", "ໄຊຍະບູລີ", "ຊຽງຂວາງ", "ໄຊສົມບູນ", "ວຽງຈັນ", 
  "ນະຄອນຫຼວງວຽງຈັນ", "ບໍລິຄຳໄຊ", "ຄຳມ່ວນ", "ສະຫວັນນະເຂດ", 
  "ສາລະວັນ", "ເຊກອງ", "ຈຳປາສັກ", "ອັດຕະປື"
];

export default function AdminPostStatsPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchStats();
  }, [filter]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      let query = supabase.from('cars').select('province, status, created_at');

      // --- ระบบกรองเวลา (Logic D/W/M/Y/A) ---
      const now = new Date();
      if (filter === 'D') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        query = query.gt('created_at', startOfDay);
      } else if (filter === 'W') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gt('created_at', lastWeek);
      } else if (filter === 'M') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gt('created_at', startOfMonth);
      } else if (filter === 'Y') {
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
        query = query.gt('created_at', startOfYear);
      }

      const { data, error } = await query;
      if (error) throw error;

      // --- ประมวลผลข้อมูล (Grouping) ---
      const processed = LAO_PROVINCES.map(prov => {
        const provData = data?.filter(item => item.province === prov) || [];
        return {
          province: prov,
          total: provData.length,
          recommend: provData.filter(item => item.status === 'recommend').length,
          sold: provData.filter(item => item.status === 'sold').length,
        };
      });

      setStats(processed);
    } catch (err) {
      console.error("Fetch Stats Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // คำนวณผลรวมแถวสุดท้าย
  const grandTotal = stats.reduce((acc, curr) => ({
    total: acc.total + curr.total,
    recommend: acc.recommend + curr.recommend,
    sold: acc.sold + curr.sold,
  }), { total: 0, recommend: 0, sold: 0 });

  return (
    <main style={{ maxWidth: '900px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>ສະຖິຕິການໂພສ</h2>
        
        <div style={{ display: 'flex', background: '#f0f2f5', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          {(['D', 'W', 'M', 'Y', 'A'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                background: filter === item ? '#fff' : 'transparent',
                color: filter === item ? '#007bff' : '#65676b',
                boxShadow: filter === item ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                transition: '0.2s'
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f2f5', color: '#1a1a1a', fontSize: '15px' }}>
              <th style={{ padding: '12px', fontWeight: '700' }}>ແຂວງ</th>
              <th style={{ padding: '12px', fontWeight: '700' }}>Post ທັງໝົດ</th>
              <th style={{ padding: '12px', fontWeight: '700' }}>ພ້ອມຂາຍ</th>
              <th style={{ padding: '12px', fontWeight: '700' }}>ຂາຍແລ້ວ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
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
              </td></tr>
            ) : (
              <>
                {stats.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f2f5', fontSize: '15px', background: '#fff', color: '#1a1a1a' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{row.province}</td>
                    <td style={{ padding: '12px' }}>{row.total.toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{row.recommend.toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{row.sold.toLocaleString()}</td>
                  </tr>
                ))}
                {/* แถวรวม (Grand Total) - พื้นหลังสีฟ้าอ่อน ตัวเลขสีดำ */}
                <tr style={{ background: '#e3f2fd', color: '#1a1a1a', fontWeight: 'bold', fontSize: '16px' }}>
                  <td style={{ padding: '15px 12px' }}>ລວມ</td>
                  <td style={{ padding: '15px 12px' }}>{grandTotal.total.toLocaleString()}</td>
                  <td style={{ padding: '15px 12px' }}>{grandTotal.recommend.toLocaleString()}</td>
                  <td style={{ padding: '15px 12px' }}>{grandTotal.sold.toLocaleString()}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

    </main>
  );
}
