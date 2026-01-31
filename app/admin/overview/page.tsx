'use client'

import { useState, useEffect } from 'react';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { applyDateFilter } from '@/utils/dateFilter';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';

import { LAO_PROVINCES } from '@/utils/constants';

export default function AdminOverviewPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    allReports: 0,
    webVisits: 0,
    highestPost: '',
    highestSold: '',
    topSeller: { name: '', count: 0, avatar: '' },
    topPost: { name: '', count: 0, avatar: '' },
    revenue: 0
  });

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchAllData();
  }, [filter]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // --- 1. All Reports ---
      let reportQuery = supabase.from('reports').select('*', { count: 'exact', head: true });
      reportQuery = applyDateFilter(reportQuery, filter);
      const { count: reportCount } = await reportQuery;

      // --- 2. Web Visits ---
      let visitQuery = supabase.from('visitor_logs').select('*', { count: 'exact', head: true });
      visitQuery = applyDateFilter(visitQuery, filter);
      const { count: visitCount } = await visitQuery;

      // --- 3. Cars Data (For Highest Post, Sold, Top Seller/Poster) ---
      let carsQuery = supabase.from('cars').select(`
        province, status, user_id, is_guest,
        profiles:user_id (username, avatar_url)
      `);
      carsQuery = applyDateFilter(carsQuery, filter);
      const { data: carsData } = await carsQuery;

      // --- 4. Revenue ---
      let revenueQuery = supabase.from('revenue_logs').select('amount');
      revenueQuery = applyDateFilter(revenueQuery, filter);
      const { data: revenueData } = await revenueQuery;

      const provinceStats: any = {};
      const soldStats: any = {};
      const userPostCount: any = {};
      const userSoldCount: any = {};

      carsData?.forEach(car => {
        provinceStats[car.province] = (provinceStats[car.province] || 0) + 1;
        if (car.status === 'sold') {
          soldStats[car.province] = (soldStats[car.province] || 0) + 1;
        }

        const userId = car.user_id || 'guest';
        const profile = Array.isArray((car as any).profiles) ? (car as any).profiles[0] : (car as any).profiles;
        const userData = {
          name: profile?.username || 'Guest User',
          avatar: profile?.avatar_url || ''
        };

        userPostCount[userId] = { ...userData, count: (userPostCount[userId]?.count || 0) + 1 };
        if (car.status === 'sold') {
          userSoldCount[userId] = { ...userData, count: (userSoldCount[userId]?.count || 0) + 1 };
        }
      });

      const getTop = (obj: any) => Object.values(obj).sort((a: any, b: any) => b.count - a.count)[0] as any;
      const getTopKey = (obj: any) => Object.entries(obj).sort((a: any, b: any) => (b[1] as number) - (a[1] as number))[0]?.[0] || '-';

      setData({
        allReports: reportCount || 0,
        webVisits: visitCount || 0,
        highestPost: getTopKey(provinceStats),
        highestSold: getTopKey(soldStats),
        topSeller: getTop(userSoldCount) || { name: '-', count: 0, avatar: '' },
        topPost: getTop(userPostCount) || { name: '-', count: 0, avatar: '' },
        revenue: revenueData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
      });

    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Styles จัดเรียงเป็นแนวตั้งตามรูปภาพ ---
  const containerStyle = {
    maxWidth: '600px', // ปรับความกว้างให้พอดีกับแนวตั้ง
    margin: '0 auto',
    background: '#f8f9fa',
    minHeight: '100vh',
    paddingBottom: '50px'
  };

  const stackStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px', // ช่องว่างระหว่างแถวตามรูป
    padding: '0 20px'
  };

  return (
    <main style={containerStyle}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px 20px', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 10 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>Overview</h1>
        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      <div style={stackStyle}>
        {/* All Report */}
        <StatCard
          label="All report"
          value={`${data.allReports.toLocaleString()} ຄັ້ງ`}
          loading={loading}
        />

        {/* Web visit */}
        <StatCard
          label="Web visit"
          value={`${data.webVisits.toLocaleString()} ຄັ້ງ`}
          loading={loading}
        />

        {/* Highest Post */}
        <StatCard
          label="Highest post:"
          value={data.highestPost}
          loading={loading}
        />

        {/* Highest Sold */}
        <StatCard
          label="Highest Sold:"
          value={data.highestSold}
          loading={loading}
        />

        {/* Top Seller */}
        <div style={{
          background: '#fff',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: '#1a1a1a', fontSize: '16px', fontWeight: '500' }}>Top Seller</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
              {data.topSeller.avatar && <img src={data.topSeller.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? '...' : data.topSeller.name}
            </span>
            <span style={{ color: '#4a4d52', fontSize: '14px', flexShrink: 0 }}>{data.topSeller.count} ຄັນ</span>
          </div>
        </div>

        {/* Top Poster */}
        <div style={{
          background: '#fff',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: '#1a1a1a', fontSize: '16px', fontWeight: '500' }}>Top poster</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
              {data.topPost.avatar && <img src={data.topPost.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? '...' : data.topPost.name}
            </span>
            <span style={{ color: '#4a4d52', fontSize: '14px', flexShrink: 0 }}>{data.topPost.count} ຄັນ</span>
          </div>
        </div>

        {/* Revenue */}
        <StatCard
          label="Revenue"
          value={`${data.revenue.toLocaleString('de-DE')} ກີບ`}
          loading={loading}
        />
      </div>
    </main>
  );
}
