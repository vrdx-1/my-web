'use client'
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminVisitorStatsPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [loading, setLoading] = useState(true);
  
  // โครงสร้างข้อมูลใหม่แบ่งเป็น 2 แถว
  const [stats, setStats] = useState({
    visitors: { total: 0, new: 0, old: 0 }, // แถวที่ 1: จำนวนคน
    views: { total: 0, new: 0, old: 0 } // แถวที่ 2: ยอดวิว
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchVisitorStats();
  }, [filter]);

  const fetchVisitorStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string | null = null;

      if (filter === 'D') startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      else if (filter === 'W') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      else if (filter === 'M') startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      else if (filter === 'Y') startDate = new Date(now.getFullYear(), 0, 1).toISOString();

      // 1. ดึงข้อมูล Log ทั้งหมดในช่วงเวลาที่เลือก พร้อมคอลัมน์ is_first_visit
      let query = supabase.from('visitor_logs').select('visitor_id, is_first_visit, created_at');
      if (startDate) query = query.gt('created_at', startDate);
      
      const { data: currentLogs, error: logError } = await query;
      if (logError) throw logError;

      const safeLogs = currentLogs || [];

      // --- จุดที่แก้ไข: เปลี่ยนมาคำนวณจากคอลัมน์ is_first_visit โดยตรง ---
      
      // หา Unique Visitors ทั้งหมดในชุดข้อมูลนี้
      const uniqueVisitors = Array.from(new Set(safeLogs.map(l => l.visitor_id)));
      
      // หาว่าในบรรดา Unique Visitors ใครที่มีสถานะเป็น "คนใหม่" (เคยมี is_first_visit เป็น true อย่างน้อย 1 ครั้ง)
      const newVisitorIds = new Set(
        safeLogs.filter(l => l.is_first_visit === true).map(l => l.visitor_id)
      );

      const visitorStats = {
        total: uniqueVisitors.length,
        new: newVisitorIds.size,
        old: uniqueVisitors.length - newVisitorIds.size
      };

      const viewStats = {
        total: safeLogs.length,
        new: safeLogs.filter(l => l.is_first_visit === true).length,
        old: safeLogs.filter(l => l.is_first_visit === false).length
      };
      // -----------------------------------------------------------

      setStats({ visitors: visitorStats, views: viewStats });

    } catch (err) {
      console.error("Fetch Stats Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sectionLabelStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '15px',
    display: 'block'
  };

  const cardStyle = {
    flex: 1,
    padding: '20px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    textAlign: 'center' as const,
    border: '1px solid #f0f2f5'
  };

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>ສະຖິຕິຜູ້ເຂົ້າຊົມ</h2>
        
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

      {/* แถวที่ 1: จำนวนคน (Visitors) */}
      <div style={{ marginBottom: '40px' }}>
        <span style={sectionLabelStyle}>ຈຳນວນຄົນ (Visitors)</span>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ທັງໝົດ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.visitors.total.toLocaleString()} ຄົນ</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ຄົນໃໝ່</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.visitors.new.toLocaleString()} ຄົນ</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ຄົນເກົ່າ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.visitors.old.toLocaleString()} ຄົນ</div>
          </div>
        </div>
      </div>

      {/* แถวที่ 2: ยอดวิว (Views) */}
      <div>
        <span style={sectionLabelStyle}>ຍອດວິວ (Views)</span>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ທັງໝົດ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.views.total.toLocaleString()} ຄັ້ງ</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ຄົນໃໝ່</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.views.new.toLocaleString()} ຄັ້ງ</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: '#65676b', fontSize: '14px' }}>ຄົນເກົ່າ</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>{loading ? '...' : stats.views.old.toLocaleString()} ຄັ້ງ</div>
          </div>
        </div>
      </div>

    </main>
  );
}
