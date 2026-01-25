'use client'
import { useState, useEffect } from 'react';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { applyDateFilter } from '@/utils/dateFilter';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';

export default function AdminVisitorStatsPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [loading, setLoading] = useState(true);
  
  // โครงสร้างข้อมูลใหม่แบ่งเป็น 2 แถว
  const [stats, setStats] = useState({
    visitors: { total: 0, new: 0, old: 0 }, // แถวที่ 1: จำนวนคน
    views: { total: 0, new: 0, old: 0 } // แถวที่ 2: ยอดวิว
  });

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchVisitorStats();
  }, [filter]);

  const fetchVisitorStats = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูล Log ทั้งหมดในช่วงเวลาที่เลือก พร้อมคอลัมน์ is_first_visit
      let query = supabase.from('visitor_logs').select('visitor_id, is_first_visit, created_at');
      query = applyDateFilter(query, filter);
      
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

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>ສະຖິຕິຜູ້ເຂົ້າຊົມ</h2>
        
        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      {/* แถวที่ 1: จำนวนคน (Visitors) */}
      <div style={{ marginBottom: '40px' }}>
        <span style={sectionLabelStyle}>ຈຳນວນຄົນ (Visitors)</span>
        <div style={{ display: 'flex', gap: '15px' }}>
          <StatCard
            label="ທັງໝົດ"
            value={`${stats.visitors.total.toLocaleString()} ຄົນ`}
            loading={loading}
            variant="centered"
          />
          <StatCard
            label="ຄົນໃໝ່"
            value={`${stats.visitors.new.toLocaleString()} ຄົນ`}
            loading={loading}
            variant="centered"
          />
          <StatCard
            label="ຄົນເກົ່າ"
            value={`${stats.visitors.old.toLocaleString()} ຄົນ`}
            loading={loading}
            variant="centered"
          />
        </div>
      </div>

      {/* แถวที่ 2: ยอดวิว (Views) */}
      <div>
        <span style={sectionLabelStyle}>ຍອດວິວ (Views)</span>
        <div style={{ display: 'flex', gap: '15px' }}>
          <StatCard
            label="ທັງໝົດ"
            value={`${stats.views.total.toLocaleString()} ຄັ້ງ`}
            loading={loading}
            variant="centered"
          />
          <StatCard
            label="ໃໝ່"
            value={`${stats.views.new.toLocaleString()} ຄັ້ງ`}
            loading={loading}
            variant="centered"
          />
          <StatCard
            label="ເກົ່າ"
            value={`${stats.views.old.toLocaleString()} ຄັ້ງ`}
            loading={loading}
            variant="centered"
          />
        </div>
      </div>

    </main>
  );
}
