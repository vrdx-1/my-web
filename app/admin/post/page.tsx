'use client'
import { useState, useEffect } from 'react';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { applyDateFilter } from '@/utils/dateFilter';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';

import { LAO_PROVINCES } from '@/utils/constants';

export default function AdminPostStatsPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchStats();
  }, [filter]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      let query = supabase.from('cars').select('province, status, created_at');

      // --- ระบบกรองเวลา - ใช้ shared utility ---
      query = applyDateFilter(query, filter);

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
                color: filter === item ? '#007bff' : '#4a4d52',
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
                <LoadingSpinner />
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
